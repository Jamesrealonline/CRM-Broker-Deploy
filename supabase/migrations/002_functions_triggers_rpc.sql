-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 002: FUNCTIONS, TRIGGERS & RPC PROCEDURES
-- ========================================================

-- 1. HELPER FUNCTIONS CHO ROW LEVEL SECURITY (RLS)
CREATE OR REPLACE FUNCTION current_role() 
RETURNS VARCHAR AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_agency() 
RETURNS UUID AS $$
    SELECT agency_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_team() 
RETURNS UUID AS $$
    SELECT team_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_director() 
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'director') AND status = 'active'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. TRIGGER TỰ ĐỘNG GHI AUDIT VÀ KIỂM TRA CHUYỂN TRẠNG THÁI LEAD
CREATE OR REPLACE FUNCTION trigger_lead_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_has_tx BOOLEAN := false;
BEGIN
    -- Chỉ thực hiện khi trạng thái thay đổi
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Ràng buộc nghiệp vụ: Booking, Cọc, HĐMB bắt buộc có Transaction hợp lệ
        IF NEW.status = 'booking' THEN
            SELECT EXISTS (
                SELECT 1 FROM transactions 
                WHERE lead_id = NEW.id AND type = 'booking' AND status = 'confirmed' AND code IS NOT NULL
            ) INTO v_has_tx;
            IF NOT v_has_tx THEN
                RAISE EXCEPTION 'Trạng thái Booking bắt buộc phải có thông tin giao dịch Booking với mã Booking xác nhận!';
            END IF;
        ELSIF NEW.status = 'deposit' THEN
            SELECT EXISTS (
                SELECT 1 FROM transactions 
                WHERE lead_id = NEW.id AND type = 'deposit' AND status = 'confirmed' AND amount > 0
            ) INTO v_has_tx;
            IF NOT v_has_tx THEN
                RAISE EXCEPTION 'Trạng thái Đặt cọc bắt buộc phải có thông tin giao dịch Cọc với số tiền và ngày cọc hợp lệ!';
            END IF;
        ELSIF NEW.status = 'contract' THEN
            SELECT EXISTS (
                SELECT 1 FROM transactions 
                WHERE lead_id = NEW.id AND type = 'contract' AND status = 'confirmed' AND contract_code IS NOT NULL
            ) INTO v_has_tx;
            IF NOT v_has_tx THEN
                RAISE EXCEPTION 'Trạng thái Ký HĐMB bắt buộc phải có thông tin giao dịch với mã hợp đồng HĐMB!';
            END IF;
        END IF;

        -- Tự động ghi vào lead_status_history
        INSERT INTO lead_status_history (
            lead_id, 
            changed_by, 
            old_status, 
            new_status, 
            notes
        ) VALUES (
            NEW.id,
            auth.uid(),
            OLD.status,
            NEW.status,
            COALESCE(NEW.notes, 'Cập nhật trạng thái Customer Journey')
        );

        NEW.last_action_at := NOW();
        NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_lead_status_change
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_lead_status_change();

-- 3. HÀM PHÂN BỔ ROUND ROBIN (RPC - ATOMIC TRANSACTION)
CREATE OR REPLACE FUNCTION assign_lead_round_robin(
    p_lead_id UUID,
    p_project_id UUID,
    p_team_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sale_id UUID;
    v_sale_name VARCHAR;
    v_team_id UUID;
    v_agency_id UUID;
    v_max_leads INT := 50;
    v_old_assignee UUID;
BEGIN
    -- Lấy cài đặt giới hạn Lead mỗi Sale từ system_settings
    SELECT (value->>'max_leads_per_sale')::INT 
    INTO v_max_leads 
    FROM system_settings 
    WHERE key = 'distribution_rules';
    
    IF v_max_leads IS NULL THEN
        v_max_leads := 50;
    END IF;

    -- Lấy thông tin hiện tại của Lead và khoá dòng
    SELECT assigned_to INTO v_old_assignee 
    FROM leads 
    WHERE id = p_lead_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy Lead chỉ định.');
    END IF;

    -- Tìm Sale Agent đủ điều kiện theo Round Robin:
    -- 1. Status = 'active'
    -- 2. Role = 'sale_agent' (hoặc team_leader)
    -- 3. Đã được phân quyền dự án trong user_projects
    -- 4. Nếu truyền p_team_id thì phải đúng team
    -- 5. Số Lead đang active (chưa đóng / lost) chưa vượt v_max_leads
    -- 6. Sắp xếp theo thời gian nhận Lead cuối cùng cũ nhất (hoặc chưa nhận bao giờ)
    SELECT p.id, p.full_name, p.team_id, p.agency_id
    INTO v_sale_id, v_sale_name, v_team_id, v_agency_id
    FROM profiles p
    JOIN user_projects up ON up.user_id = p.id AND up.project_id = p_project_id
    LEFT JOIN (
        SELECT assigned_to, COUNT(*) as active_leads_count, MAX(assigned_at) as last_assigned
        FROM leads l
        LEFT JOIN lead_assignments la ON la.lead_id = l.id AND la.new_assignee = l.assigned_to
        WHERE l.status NOT IN ('contract', 'after_sales', 'lost')
        GROUP BY assigned_to
    ) lead_stats ON lead_stats.assigned_to = p.id
    WHERE p.status = 'active'
      AND p.role IN ('sale_agent', 'team_leader')
      AND (p_team_id IS NULL OR p.team_id = p_team_id)
      AND COALESCE(lead_stats.active_leads_count, 0) < v_max_leads
    ORDER BY COALESCE(lead_stats.last_assigned, '1970-01-01'::timestamptz) ASC,
             COALESCE(lead_stats.active_leads_count, 0) ASC
    LIMIT 1
    FOR UPDATE OF p;

    IF v_sale_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Không tìm thấy Sale phù hợp (tất cả Sale đã đạt giới hạn Lead hoặc chưa được phân quyền dự án này).'
        );
    END IF;

    -- Cập nhật Lead
    UPDATE leads 
    SET assigned_to = v_sale_id,
        team_id = COALESCE(v_team_id, leads.team_id),
        agency_id = COALESCE(v_agency_id, leads.agency_id),
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- Ghi nhận lịch sử phân bổ
    INSERT INTO lead_assignments (
        lead_id, 
        assigned_by, 
        previous_assignee, 
        new_assignee, 
        method, 
        reason
    ) VALUES (
        p_lead_id,
        auth.uid(),
        v_old_assignee,
        v_sale_id,
        'round_robin',
        'Phân bổ tự động Round Robin theo dự án'
    );

    -- Ghi activity
    INSERT INTO lead_activities (
        lead_id, 
        user_id, 
        type, 
        title, 
        content
    ) VALUES (
        p_lead_id,
        v_sale_id,
        'system',
        'Hệ thống tự động phân bổ Lead',
        'Lead được phân bổ cho chuyên viên ' || v_sale_name || ' theo quy tắc Round Robin.'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'sale_id', v_sale_id, 
        'sale_name', v_sale_name,
        'message', 'Phân bổ thành công cho ' || v_sale_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. HÀM CHUYỂN TRẠNG THÁI GIAO DỊCH AN TOÀN (RPC)
CREATE OR REPLACE FUNCTION update_lead_stage_with_transaction(
    p_lead_id UUID,
    p_new_status VARCHAR,
    p_tx_code VARCHAR DEFAULT NULL,
    p_tx_amount NUMERIC DEFAULT NULL,
    p_tx_date TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_deal_id UUID;
    v_project_id UUID;
    v_assigned_to UUID;
BEGIN
    SELECT project_id, assigned_to INTO v_project_id, v_assigned_to 
    FROM leads WHERE id = p_lead_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy Lead.');
    END IF;

    -- Nếu chuyển sang Booking, Cọc hoặc HĐMB, tự tạo/cập nhật Transaction trước
    IF p_new_status = 'booking' THEN
        IF p_tx_code IS NULL OR trim(p_tx_code) = '' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Mã Booking là bắt buộc khi chuyển trạng thái Booking!');
        END IF;
        
        INSERT INTO transactions (
            lead_id, type, code, amount, transaction_date, status, notes, created_by
        ) VALUES (
            p_lead_id, 'booking', p_tx_code, COALESCE(p_tx_amount, 50000000), 
            COALESCE(p_tx_date, NOW()), 'confirmed', p_notes, auth.uid()
        );

    ELSIF p_new_status = 'deposit' THEN
        IF p_tx_amount IS NULL OR p_tx_amount <= 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Số tiền cọc hợp lệ là bắt buộc khi chuyển trạng thái Đặt cọc!');
        END IF;

        INSERT INTO transactions (
            lead_id, type, code, amount, transaction_date, status, notes, created_by
        ) VALUES (
            p_lead_id, 'deposit', COALESCE(p_tx_code, 'DC-' || to_char(NOW(), 'YYYYMMDDHH24MISS')), 
            p_tx_amount, COALESCE(p_tx_date, NOW()), 'confirmed', p_notes, auth.uid()
        );

    ELSIF p_new_status = 'contract' THEN
        IF p_tx_code IS NULL OR trim(p_tx_code) = '' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Mã hợp đồng HĐMB là bắt buộc!');
        END IF;

        INSERT INTO transactions (
            lead_id, type, code, contract_code, amount, transaction_date, status, notes, created_by
        ) VALUES (
            p_lead_id, 'contract', p_tx_code, p_tx_code, 
            COALESCE(p_tx_amount, 0), COALESCE(p_tx_date, NOW()), 'confirmed', p_notes, auth.uid()
        );
    END IF;

    -- Cập nhật Lead status (trigger sẽ kiểm tra lại)
    UPDATE leads 
    SET status = p_new_status,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_lead_id;

    RETURN jsonb_build_object('success', true, 'message', 'Cập nhật trạng thái thành công.');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
