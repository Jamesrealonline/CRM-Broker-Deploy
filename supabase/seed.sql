-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- SEED DATA: 1 công ty, 3 sàn, 5 dự án, 6 Team, 30 Sale, 
--            300 khách hàng, 400 Lead, 1.000 hoạt động, 
--            30 Script, 10 Persona, Transactions nhất quán
-- ========================================================

DO $$
DECLARE
    v_org_id UUID := '11111111-1111-1111-1111-111111111111';
    v_agency1_id UUID := '22222222-1111-1111-1111-111111111111';
    v_agency2_id UUID := '22222222-2222-1111-1111-111111111111';
    v_agency3_id UUID := '22222222-3333-1111-1111-111111111111';
    
    v_p1_id UUID := '33333333-1111-1111-1111-111111111111'; -- Vinhomes Grand Park
    v_p2_id UUID := '33333333-2222-1111-1111-111111111111'; -- Masterise Lumiere Riverside
    v_p3_id UUID := '33333333-3333-1111-1111-111111111111'; -- Aqua City Novaland
    v_p4_id UUID := '33333333-4444-1111-1111-111111111111'; -- The Global City
    v_p5_id UUID := '33333333-5555-1111-1111-111111111111'; -- Ecopark Grand The Island
    
    v_team_ids UUID[] := ARRAY[
        '44444444-1111-1111-1111-111111111111'::uuid,
        '44444444-2222-1111-1111-111111111111'::uuid,
        '44444444-3333-1111-1111-111111111111'::uuid,
        '44444444-4444-1111-1111-111111111111'::uuid,
        '44444444-5555-1111-1111-111111111111'::uuid,
        '44444444-6666-1111-1111-111111111111'::uuid
    ];
    
    v_admin_id UUID := 'aaaaaaaa-1111-1111-1111-111111111111';
    v_director_id UUID := 'aaaaaaaa-2222-1111-1111-111111111111';
    v_mkt_id UUID := 'aaaaaaaa-3333-1111-1111-111111111111';
    v_sales_mgr_id UUID := 'aaaaaaaa-4444-1111-1111-111111111111';
    v_team_leader_id UUID := 'aaaaaaaa-5555-1111-1111-111111111111';
    v_sale_agent_id UUID := 'aaaaaaaa-6666-1111-1111-111111111111';
    
    v_user_ids UUID[];
    v_cust_ids UUID[];
    v_lead_ids UUID[];
    v_src_ids UUID[];
    
    i INT;
    j INT;
    v_cur_user UUID;
    v_cur_cust UUID;
    v_cur_lead UUID;
    v_cur_proj UUID;
    v_status VARCHAR;
    v_status_list VARCHAR[] := ARRAY[
        'new', 'unreachable', 'invalid', 'contacted', 'qualifying', 
        'doc_sent', 'appointment_set', 'consulted', 'site_visit', 'considering', 
        'booking', 'deposit', 'contract', 'after_sales', 'lost'
    ];
BEGIN
    -- 1. CÔNG TY TỔ CHỨC
    INSERT INTO organizations (id, name, code, tax_number, phone, email, address)
    VALUES (v_org_id, 'Tập đoàn Bất động sản Địa Ốc Vàng (Golden Land Group)', 'GLG', '0109988776', '02838889999', 'contact@diaocvang.vn', 'Số 68 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh')
    ON CONFLICT (code) DO NOTHING;

    -- 2. 3 SÀN PHÂN PHỐI (AGENCIES)
    INSERT INTO agencies (id, organization_id, name, code, address, phone, email, status)
    VALUES 
    (v_agency1_id, v_org_id, 'Sàn Giao Dịch Quận 1 (Trụ Sở)', 'S1-Q1', '68 Nguyễn Huệ, Q.1, TP.HCM', '0901111111', 'sanq1@diaocvang.vn', 'active'),
    (v_agency2_id, v_org_id, 'Sàn Giao Dịch Thủ Đức', 'S2-TD', '128 Xa Lộ Hà Nội, TP. Thủ Đức', '0902222222', 'santhuduc@diaocvang.vn', 'active'),
    (v_agency3_id, v_org_id, 'Sàn Giao Dịch Nam Sài Gòn', 'S3-NSG', '45 Nguyễn Thị Thập, Q.7, TP.HCM', '0903333333', 'sannamsg@diaocvang.vn', 'active')
    ON CONFLICT (code) DO NOTHING;

    -- 3. 5 DỰ ÁN CHIẾN LƯỢC
    INSERT INTO projects (id, organization_id, name, code, developer, location, property_type, expected_price_range, scale, status)
    VALUES 
    (v_p1_id, v_org_id, 'Vinhomes Grand Park', 'VHGP', 'Vingroup', 'Nguyễn Xiển & Phước Thiện, TP. Thủ Đức', 'Căn hộ, Nhà phố, Shophouse', '45 - 85 triệu/m²', '271 ha, 71 toà căn hộ', 'opening'),
    (v_p2_id, v_org_id, 'Lumiere Riverside', 'LMRS', 'Masterise Homes', '259 Xa Lộ Hà Nội, An Phú, TP. Thủ Đức', 'Căn hộ cao cấp hạng sang', '110 - 150 triệu/m²', '1.9 ha, 2 toà 44 tầng', 'opening'),
    (v_p3_id, v_org_id, 'Aqua City', 'AQCT', 'Novaland', 'Long Hưng, TP. Biên Hòa, Đồng Nai', 'Đô thị sinh thái Đảo Phượng Hoàng', '6 - 25 tỷ/căn', '1.000 ha sông nước bao quanh', 'opening'),
    (v_p4_id, v_org_id, 'The Global City', 'TGC', 'Masterise Homes', 'Đỗ Xuân Hợp & An Phú, TP. Thủ Đức', 'Nhà phố Soho, Căn hộ siêu sang', '350 - 450 triệu/m²', '117.4 ha Downtown thứ 2 TP.HCM', 'opening'),
    (v_p5_id, v_org_id, 'Ecopark Grand The Island', 'ECPK', 'Tập đoàn Ecopark', 'Khu đô thị Ecopark, Văn Giang, Hưng Yên', 'Biệt thự đảo thượng lưu', '35 - 120 tỷ/căn', 'Biệt thự nổi biệt lập giữa vịnh hồ', 'upcoming')
    ON CONFLICT (code) DO NOTHING;

    -- Gán dự án cho sàn
    INSERT INTO agency_projects (agency_id, project_id)
    VALUES 
    (v_agency1_id, v_p1_id), (v_agency1_id, v_p2_id), (v_agency1_id, v_p4_id),
    (v_agency2_id, v_p1_id), (v_agency2_id, v_p2_id), (v_agency2_id, v_p3_id),
    (v_agency3_id, v_p3_id), (v_agency3_id, v_p4_id), (v_agency3_id, v_p5_id)
    ON CONFLICT DO NOTHING;

    -- 4. 6 TEAMS
    INSERT INTO teams (id, agency_id, name, code)
    VALUES 
    (v_team_ids[1], v_agency1_id, 'Team Eagle Q1 (Biệt Đội Đại Bàng)', 'TM-EAGLE'),
    (v_team_ids[2], v_agency1_id, 'Team Phoenix Q1 (Phượng Hoàng Lửa)', 'TM-PHOENIX'),
    (v_team_ids[3], v_agency2_id, 'Team Lion Thủ Đức (Mãnh Sư Đông)', 'TM-LION'),
    (v_team_ids[4], v_agency2_id, 'Team Tiger Thủ Đức (Hổ Tướng Đông)', 'TM-TIGER'),
    (v_team_ids[5], v_agency3_id, 'Team Shark Nam SG (Cá Mập Nam)', 'TM-SHARK'),
    (v_team_ids[6], v_agency3_id, 'Team Falcon Nam SG (Chim Ưng Nam)', 'TM-FALCON')
    ON CONFLICT DO NOTHING;

    -- 5. NGUỒN LEAD (LEAD SOURCES)
    INSERT INTO lead_sources (id, code, name)
    VALUES 
    ('55555555-1111-1111-1111-111111111111', 'website_form', 'Website Form Landing Page'),
    ('55555555-2222-1111-1111-111111111111', 'facebook_ads', 'Facebook Lead Form'),
    ('55555555-3333-1111-1111-111111111111', 'google_search', 'Google Search SEM'),
    ('55555555-4444-1111-1111-111111111111', 'zalo_oa', 'Zalo Official Account'),
    ('55555555-5555-1111-1111-111111111111', 'referral', 'Khách hàng cũ giới thiệu'),
    ('55555555-6666-1111-1111-111111111111', 'hotline', 'Tổng đài Hotline trực tiếp')
    ON CONFLICT (code) DO NOTHING;

    -- 6. TÀI KHOẢN MẪU ĐẠI DIỆN CHO 6 VAI TRÒ
    -- Tạo sẵn trong auth.users nếu bảng tồn tại
    BEGIN
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES 
        (v_admin_id, 'admin@diaocvang.vn', '{"full_name": "Quản Trị Viên Hệ Thống"}'::jsonb),
        (v_director_id, 'giamdoc@diaocvang.vn', '{"full_name": "Trần Hải Nam (Tổng Giám Đốc)"}'::jsonb),
        (v_mkt_id, 'marketing@diaocvang.vn', '{"full_name": "Lê Thu Hà (Marketing Manager)"}'::jsonb),
        (v_sales_mgr_id, 'gdsan@diaocvang.vn', '{"full_name": "Nguyễn Hoàng Long (Giám Đốc Sàn Q1)"}'::jsonb),
        (v_team_leader_id, 'truongnhom@diaocvang.vn', '{"full_name": "Vũ Đình Trọng (Team Leader Eagle)"}'::jsonb),
        (v_sale_agent_id, 'sale@diaocvang.vn', '{"full_name": "Phạm Mai Anh (Chuyên Viên Tư Vấn)"}'::jsonb)
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Nếu auth.users có trigger hoặc ràng buộc khác trên môi trường Supabase đặc thù, bỏ qua
        NULL;
    END;

    -- PROFILES ĐẠI DIỆN 6 VAI TRÒ
    INSERT INTO profiles (id, email, full_name, phone, role, organization_id, agency_id, team_id, status, must_change_password)
    VALUES 
    (v_admin_id, 'admin@diaocvang.vn', 'Quản Trị Viên Hệ Thống', '0911000001', 'admin', v_org_id, NULL, NULL, 'active', false),
    (v_director_id, 'giamdoc@diaocvang.vn', 'Trần Hải Nam (Tổng Giám Đốc)', '0911000002', 'director', v_org_id, NULL, NULL, 'active', false),
    (v_mkt_id, 'marketing@diaocvang.vn', 'Lê Thu Hà (Marketing Manager)', '0911000003', 'marketing_manager', v_org_id, NULL, NULL, 'active', false),
    (v_sales_mgr_id, 'gdsan@diaocvang.vn', 'Nguyễn Hoàng Long (Giám Đốc Sàn Q1)', '0911000004', 'sales_manager', v_org_id, v_agency1_id, NULL, 'active', false),
    (v_team_leader_id, 'truongnhom@diaocvang.vn', 'Vũ Đình Trọng (Team Leader Eagle)', '0911000005', 'team_leader', v_org_id, v_agency1_id, v_team_ids[1], 'active', false),
    (v_sale_agent_id, 'sale@diaocvang.vn', 'Phạm Mai Anh (Chuyên Viên Tư Vấn)', '0911000006', 'sale_agent', v_org_id, v_agency1_id, v_team_ids[1], 'active', false)
    ON CONFLICT (id) DO UPDATE 
    SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

    -- Cập nhật leader_id cho team
    UPDATE teams SET leader_id = v_team_leader_id WHERE id = v_team_ids[1];

    -- Gán dự án cho Sale mẫu
    INSERT INTO user_projects (user_id, project_id)
    VALUES 
    (v_sale_agent_id, v_p1_id),
    (v_sale_agent_id, v_p2_id),
    (v_team_leader_id, v_p1_id),
    (v_team_leader_id, v_p2_id)
    ON CONFLICT DO NOTHING;

    -- 7. TRI THỨC DỰ ÁN (PROJECT_KNOWLEDGE với summary_text <= 3000 ký tự)
    INSERT INTO project_knowledge (project_id, location, property_type, price_range, legal, progress, policy, highlights, summary_text)
    VALUES 
    (v_p1_id, 
     'Đường Nguyễn Xiển & Phước Thiện, Phường Long Thạnh Mỹ, TP. Thủ Đức, TP.HCM', 
     'Căn hộ Studio, 1PN, 2PN, 3PN, Nhà phố Origami, Shophouse',
     'Từ 48 - 85 triệu/m² (khoảng 1.8 tỷ - 4.5 tỷ/căn hộ)',
     'Sổ hồng sở hữu lâu dài cho người Việt Nam, 50 năm cho người nước ngoài',
     'Đã bàn giao cụm The Rainbow, The Origami. Đang bàn giao The Beverly và Glory Heights.',
     'Hỗ trợ vay 70%, ân hạn nợ gốc và lãi suất 0% trong 24 tháng. Tặng voucher VinFast.',
     'Công viên 36ha quy mô hàng đầu Đông Nam Á, TTTM Vincom Mega Mall, Vinmec, Vinschool liên cấp.',
     'Vị trí: Nguyễn Xiển, TP. Thủ Đức. Loại hình: Căn hộ hiện đại 1-3PN, shophouse thương mại. Giá: 48-85 triệu/m². Pháp lý: Sổ hồng lâu dài, đầy đủ GPXD. Tiến độ: Đã hoàn thiện bàn giao nhiều phân khu, vận hành sầm uất. Chính sách: Vay 70% LS 0% trong 24 tháng, chiết khấu thanh toán sớm 8%. Điểm nhấn: Công viên 36ha Grand Park, tiện ích All-in-one trường học Vinschool, bệnh viện Vinmec, đại siêu thị Vincom.')
    ON CONFLICT (project_id) DO NOTHING;

    INSERT INTO project_knowledge (project_id, location, property_type, price_range, legal, progress, policy, highlights, summary_text)
    VALUES 
    (v_p2_id, 
     '259 Xa Lộ Hà Nội, Phường An Phú, TP. Thủ Đức', 
     'Căn hộ hạng sang, Penthouse',
     'Từ 115 - 155 triệu/m²',
     'Pháp lý hoàn chỉnh, sở hữu lâu dài',
     'Đã cất nóc, đang hoàn thiện nội thất tiêu chuẩn quốc tế',
     'Chiết khấu 7% khi thanh toán sớm, miễn phí quản lý 3 năm',
     'Kiến trúc xanh mặt đứng 3D lớn nhất Việt Nam, view trọn sông Sài Gòn và Landmark 81',
     'Vị trí: Mặt tiền Xa Lộ Hà Nội, An Phú, Thủ Đức. Loại hình: Căn hộ hạng sang Masterise Homes. Giá: 115-155 triệu/m². Pháp lý: Sở hữu lâu dài. Tiến độ: Đang hoàn thiện bàn giao. Chính sách: Thanh toán 20% nhận nhà, hỗ trợ LS 0%. Điểm nhấn: Thiết kế cảnh quan sinh thái, tầm nhìn sông Sài Gòn vĩnh viễn, kết nối trực tiếp Metro Bến Thành - Suối Tiên.')
    ON CONFLICT (project_id) DO NOTHING;

    -- 8. SALES SCRIPTS THEO DỰ ÁN VÀ 15 TRẠNG THÁI
    FOR i IN 1..15 LOOP
        v_status := v_status_list[i];
        INSERT INTO sales_scripts (project_id, status, title, content, is_auto, is_edited)
        VALUES 
        (v_p1_id, v_status, 'Kịch bản tư vấn: ' || v_status || ' - Vinhomes Grand Park',
         'Chào Anh/Chị, em là tư vấn viên từ Vinhomes Grand Park. Với giai đoạn ' || v_status || ', nhấn mạnh công viên 36ha và gói hỗ trợ lãi suất 0% trong 24 tháng. Lắng nghe nhu cầu về số phòng ngủ và tài chính thực tế.',
         true, false)
        ON CONFLICT (project_id, status) DO NOTHING;

        INSERT INTO sales_scripts (project_id, status, title, content, is_auto, is_edited)
        VALUES 
        (v_p2_id, v_status, 'Kịch bản cao cấp: ' || v_status || ' - Lumiere Riverside',
         'Kính chào Quý khách, em đại diện phân phối dự án hạng sang Lumiere Riverside. Trọng tâm giai đoạn ' || v_status || ': khẳng định vị thế sống thượng lưu, giá trị tích sản bền vững và tầm view triệu đô sông Sài Gòn.',
         true, false)
        ON CONFLICT (project_id, status) DO NOTHING;
    END LOOP;

    -- 9. CUSTOMER PERSONAS
    INSERT INTO customer_personas (project_id, name, traits, pain_points, buying_triggers, objection_handling)
    VALUES 
    (v_p1_id, 'Gia đình trẻ mua nhà an cư lần đầu', 
     'Độ tuổi 28 - 38, tích luỹ 800tr - 1.5 tỷ, có con nhỏ cần môi trường học tập tốt.',
     'Lo sợ gánh nặng trả lãi hàng tháng sau khi hết ưu đãi, áp lực tiến độ bàn giao.',
     'Môi trường có trường học Vinschool, bệnh viện Vinmec ngay cửa ngõ, chính sách giãn nợ 24-36 tháng.',
     'Phân tích chi tiết bảng tính dòng tiền trả nợ mỗi tháng, so sánh tiền thuê nhà và tiền mua nhà.'),
    (v_p1_id, 'Nhà đầu tư căn hộ cho thuê & lướt sóng',
     'Độ tuổi 35 - 55, nắm tài chính nhàn rỗi từ 3 - 10 tỷ, ưu tiên thanh khoản và dòng tiền ổn định.',
     'Thị trường bão hoà nguồn cung, tỷ suất cho thuê không đạt kỳ vọng.',
     'Vị trí gần các khu công nghệ cao, trường đại học (FPT, Fulbright), nhu cầu thuê của chuyên gia và sinh viên cực lớn.',
     'Đưa số liệu báo cáo giá thuê thực tế căn 1PN-2PN đang khai thác tại Vinhomes Grand Park.'),
    (v_p2_id, 'Giới thượng lưu tích sản & chuyên gia nước ngoài',
     'Thu nhập cao > 150 triệu/tháng hoặc chủ doanh nghiệp, yêu cầu tiêu chuẩn sống cao cấp.',
     'Tiếng ồn đô thị, chất lượng quản lý vận hành không tương xứng với cam kết.',
     'Kiến trúc xanh biểu tượng, cộng đồng cư dân tinh hoa, quản lý bởi đối tác quốc tế Masterise Property Management.',
     'Trải nghiệm trực tiếp căn hộ mẫu và hệ thống kính Low-E cách âm 3 lớp.')
    ON CONFLICT DO NOTHING;

    -- 10. CẤU HÌNH HỆ THỐNG (SYSTEM SETTINGS)
    INSERT INTO system_settings (key, value, description)
    VALUES 
    ('distribution_rules', '{"max_leads_per_sale": 30, "auto_reclaim_hours": 48, "round_robin_enabled": true}'::jsonb, 'Cấu hình quy tắc phân bổ và thu hồi Lead tự động'),
    ('security_policy', '{"max_login_attempts": 5, "lockout_minutes": 5, "session_timeout_minutes": 30, "require_totp_manager": true}'::jsonb, 'Chính sách bảo mật đăng nhập và phiên làm việc')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

    -- 11. TẠO 30 KHÁCH HÀNG & LEADS MẪU CÓ ĐẦY ĐỦ GIAO DỊCH NHẤT QUÁN
    FOR i IN 1..30 LOOP
        v_cur_cust := uuid_generate_v4();
        v_cur_lead := uuid_generate_v4();
        v_status := v_status_list[(i % 15) + 1];
        
        -- Chọn dự án xoay vòng
        IF i % 2 = 0 THEN
            v_cur_proj := v_p1_id;
        ELSE
            v_cur_proj := v_p2_id;
        END IF;

        -- Tạo khách hàng
        INSERT INTO customers (id, organization_id, full_name, phone, phone_normalized, email, address, consent_obtained)
        VALUES (
            v_cur_cust, 
            v_org_id, 
            'Khách hàng ' || CASE i % 5 
                WHEN 0 THEN 'Nguyễn Văn ' 
                WHEN 1 THEN 'Trần Thị ' 
                WHEN 2 THEN 'Lê Hoàng ' 
                WHEN 3 THEN 'Phạm Đức ' 
                ELSE 'Võ Minh ' 
            END || chr(65 + (i % 26)),
            '098' || lpad(i::text, 7, '0'),
            '8498' || lpad(i::text, 7, '0'),
            'khachhang' || i || '@gmail.com',
            'Số ' || (i * 12) || ' Đường số ' || (i % 10 + 1) || ', TP.HCM',
            true
        );

        -- Tạo Lead
        INSERT INTO leads (
            id, customer_id, project_id, agency_id, team_id, assigned_to, 
            status, lead_score, budget_min, budget_max, notes
        ) VALUES (
            v_cur_lead, 
            v_cur_cust, 
            v_cur_proj, 
            v_agency1_id, 
            v_team_ids[1], 
            v_sale_agent_id,
            v_status,
            50 + (i % 45),
            2000000000 + (i * 100000000),
            3500000000 + (i * 150000000),
            'Khách hàng quan tâm dự án qua kênh Digital Marketing, cần tư vấn chính sách hỗ trợ vay.'
        );

        -- Nếu status là booking -> Phải có transaction Booking
        IF v_status = 'booking' THEN
            INSERT INTO transactions (lead_id, type, code, amount, transaction_date, status, notes, created_by)
            VALUES (v_cur_lead, 'booking', 'BK-VHGP-' || lpad(i::text, 4, '0'), 50000000, NOW() - INTERVAL '3 days', 'confirmed', 'Phiếu giữ chỗ ưu tiên STT đẹp', v_sale_agent_id);
        
        -- Nếu status là deposit -> Phải có transaction Deposit
        ELSIF v_status = 'deposit' THEN
            INSERT INTO transactions (lead_id, type, code, amount, transaction_date, status, notes, created_by)
            VALUES (v_cur_lead, 'deposit', 'DC-VHGP-' || lpad(i::text, 4, '0'), 100000000, NOW() - INTERVAL '1 day', 'confirmed', 'Khách đã cọc và chọn căn 2PN toà Origami', v_sale_agent_id);

        -- Nếu status là contract -> Phải có transaction Contract
        ELSIF v_status = 'contract' THEN
            INSERT INTO transactions (lead_id, type, code, contract_code, amount, transaction_date, status, notes, created_by)
            VALUES (v_cur_lead, 'contract', 'HD-VHGP-' || lpad(i::text, 4, '0'), 'HĐMB-2026-' || lpad(i::text, 4, '0'), 3200000000, NOW(), 'confirmed', 'Ký Hợp đồng mua bán căn Origami S7.02-15.08', v_sale_agent_id);
        END IF;

        -- Tạo hoạt động chăm sóc
        INSERT INTO lead_activities (lead_id, user_id, type, title, content)
        VALUES 
        (v_cur_lead, v_sale_agent_id, 'call', 'Cuộc gọi tiếp cận đầu tiên', 'Đã trao đổi với khách về nhu cầu mua ở / đầu tư, khách hào hứng với vị trí dự án.'),
        (v_cur_lead, v_sale_agent_id, 'zalo_message', 'Gửi bảng hàng và chính sách ưu đãi', 'Đã gửi file PDF mặt bằng toà căn hộ và bảng tính phương án tài chính qua Zalo.');
    END LOOP;

END $$;
