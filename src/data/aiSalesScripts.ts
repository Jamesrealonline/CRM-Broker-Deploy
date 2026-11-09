import { LeadStatus } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';

export interface StageScriptDetail {
  status: LeadStatus;
  stageName: string;
  categoryName: string;
  psychologyAnalysis: string;
  discoveryChecklist: string[];
  actionScript: string;
  objectionHandling: string;
  nextStepCallToAction: string;
}

export const AI_MASTER_STAGE_SCRIPTS: Record<LeadStatus, StageScriptDetail> = {
  new: {
    status: 'new',
    stageName: 'Mới Tiếp Nhận (Lead Mới 5 Phút)',
    categoryName: 'Tiếp cận ban đầu',
    psychologyAnalysis: `Khách hàng vừa để lại thông tin qua bài quảng cáo (Facebook/Google/TikTok/Landing Page) trong vòng 5 - 15 phút. 
Tâm lý lúc này: Tò mò cao độ, ấn tượng về hình ảnh/giá bán còn rất mới. Tuy nhiên khách cũng dè chừng, sợ bị làm phiền hoặc sợ bị lộ số điện thoại. 
"Quy tắc 5 phút vàng": Gọi trong 5 phút đầu giúp tăng tỷ lệ kết nối thành công gấp 9 lần so với gọi sau 30 phút.`,
    discoveryChecklist: [
      'Khách hàng đăng ký từ nguồn quảng cáo nào và quan tâm loại căn nào (1PN, 2PN, 3PN hay Shophouse)?',
      'Mục đích chính của khách là mua để ở (an cư) hay đầu tư sinh lời / tích lũy tài sản?',
      'Khách hàng đã từng ghé thăm khu vực quy hoạch của dự án lần nào chưa?',
      'Khách ấn tượng nhất với điều gì: Mức giá đợt 1, chính sách ân hạn nợ gốc, hay vị trí kết nối giao thông?'
    ],
    actionScript: `Dạ em chào Anh/Chị [Tên Khách], em là [Tên Sale] phụ trách quản lý giỏ hàng trực tiếp từ Chủ đầu tư dự án [Tên Dự Án]. 

Em vừa nhận được thông tin Anh/Chị đăng ký nhận Bảng giá đợt 1 và Mặt bằng căn hộ chi tiết. Em gọi điện ngay để xác nhận và gửi đúng mã căn phù hợp với tiêu chuẩn mong muốn của gia đình mình, tránh gửi tài liệu chung chung làm phiền thời gian quý báu của Anh/Chị ạ.

Không biết gia đình mình đang tìm hiểu căn hộ để an cư hay đang nhắm phương án đầu tư sinh lời vậy Anh/Chị?`,
    objectionHandling: `Nếu khách nói "Anh/Chị chưa có nhu cầu, chỉ bấm xem thử thôi":
-> "Dạ em hiểu ạ, dự án bên em đợt này đang rất hot trên thị trường nên rất nhiều khách hàng quan tâm xem trước thông tin. Em xin phép kết bạn Zalo gửi trước 1 bảng phân tích tổng quan 3 phút để Anh/Chị lưu lại tham khảo lúc rảnh rỗi nhé ạ!"`,
    nextStepCallToAction: 'Kết bạn Zalo ngay sau cuộc gọi, gửi File tóm tắt dự án 3 trang và xin phản hồi.'
  },

  unreachable: {
    status: 'unreachable',
    stageName: 'Không Nghe Máy (Chăm Sóc Đa Khung Giờ)',
    categoryName: 'Tiếp cận ban đầu',
    psychologyAnalysis: `Khách hàng đang bận họp, đang lái xe, hoặc có thói quen chặn số lạ tiếp thị. 
Họ không hẳn là từ chối dự án, mà thời điểm tiếp cận của sale chưa hợp lý. 
Nếu sale spam gọi liên tục nhiều cuộc trong cùng 1 buổi sáng sẽ gây ức chế và khách sẽ chặn số vĩnh viễn.`,
    discoveryChecklist: [
      'Ghi nhận lịch sử các khung giờ đã gọi để tránh gọi lặp lại cùng một thời điểm.',
      'Kiểm tra SĐT trên Zalo xem khách có kích hoạt Zalo không, nắm bắt ảnh đại diện & nghề nghiệp.',
      'Chuẩn bị thông điệp có giá trị độc quyền (bảng giá kín, chính sách ưu đãi giới hạn) để gửi tin nhắn.'
    ],
    actionScript: `[Chiến Lược Tiếp Cận 3 Khung Giờ Vàng]:
- Lần 1: 10h15 - 11h30 (Giờ giải lao sáng của dân văn phòng/kinh doanh)
- Lần 2: 14h30 - 16h00 (Đầu giờ chiều khi công việc đã ổn định)
- Lần 3: 19h00 - 20h15 (Buổi tối sau bữa cơm gia đình)

[Kịch Bản Tin Nhắn Zalo/SMS Chuyên Nghiệp]:
"Dạ em chào Anh/Chị [Tên Khách], em là [Tên Sale] - chuyên viên tư vấn dự án [Tên Dự Án]. 
Vừa rồi em có gọi hỗ trợ thông tin theo đăng ký của Anh/Chị nhưng chắc Anh/Chị đang bận công việc. 
Em xin phép kết bạn Zalo để gửi trước Bảng giá gốc đợt 1 và Chính sách hỗ trợ lãi suất 0% trong 24 tháng để Anh/Chị xem lúc rảnh rỗi ạ. Chúc Anh/Chị một ngày làm việc hiệu quả!"`,
    objectionHandling: `Nếu khách nhắn lại "Tôi bận lắm, đừng gọi nữa":
-> "Dạ em rất xin lỗi vì đã làm phiền trong lúc Anh/Chị đang bận. Em xin phép không gọi điện nữa, em gửi toàn bộ tài liệu qua tin nhắn Zalo này để Anh/Chị chủ động xem khi thuận tiện ạ."`,
    nextStepCallToAction: 'Chờ 24 giờ sau tin nhắn Zalo. Nếu khách xem tin mà chưa trả lời, gửi 1 hình ảnh Flycam thực tế công trường.'
  },

  invalid: {
    status: 'invalid',
    stageName: 'Sai Số / Không Nhu Cầu (Sàng Lọc Tiết Kiệm Nguồn Lực)',
    categoryName: 'Đóng / Dừng chăm sóc',
    psychologyAnalysis: `Người nghe nhấc máy nhưng báo nhầm số, hoặc số điện thoại bị sai lệch 1 chữ số, hoặc người nghe là người thân của người có nhu cầu. 
Sale cần xác minh nhanh, lịch sự, không đôi co và tránh lãng phí thời gian vào lead rác, đồng thời tận dụng cơ hội chuyển đổi nếu người thân có nhu cầu.`,
    discoveryChecklist: [
      'Kiểm tra lại xem SĐT trên form đăng ký có bị sai số nào không.',
      'Khéo léo hỏi xem trong gia đình có ai vừa quan tâm BĐS khu vực dự án không.',
      'Đánh giá xem người nghe có tiềm năng tài chính cho các dự án khác trong tương lai không.'
    ],
    actionScript: `Dạ em xin lỗi Anh/Chị, em liên hệ từ bộ phận chăm sóc khách hàng dự án [Tên Dự Án]. 
Hệ thống bên em ghi nhận số điện thoại này có đăng ký nhận bảng giá căn hộ. 

Có thể người thân trong gia đình mình có đăng ký tìm hiểu khu căn hộ/biệt thự này không ạ? 
Nếu không phải, em xin lỗi đã làm phiền Anh/Chị ạ. Em xin phép lưu số và gỡ số điện thoại của mình khỏi danh sách cuộc gọi tự động để không làm phiền mình nữa ạ!`,
    objectionHandling: `Nếu khách gắt gỏng: "Lấy số ở đâu ra mà gọi hoài":
-> "Dạ em rất xin lỗi Anh/Chị, có thể người dùng trước hoặc ai đó gõ nhầm số điện thoại lên form web. Em cập nhật hủy ngay trên hệ thống máy chủ để đảm bảo không ai gọi lại làm phiền mình nữa ạ. Chúc Anh/Chị một ngày tốt lành!"`,
    nextStepCallToAction: 'Gắn tag invalid trên CRM, ghi chú lý do và dừng SLA để chuyển lead về kho lưu trữ.'
  },

  contacted: {
    status: 'contacted',
    stageName: 'Đã Liên Hệ Thành Công (Xây Dựng Thiện Cảm & Lòng Tin)',
    categoryName: 'Tiếp cận ban đầu',
    psychologyAnalysis: `Khách hàng đã xác nhận có quan tâm dự án và đã lắng nghe sale trao đổi ngắn. 
Tâm lý khách lúc này: Muốn có thêm thông tin để tự ngâm cứu nhưng chưa sẵn sàng gặp mặt vì sợ bị chèo kéo. 
Mục tiêu của bước này: Tạo ấn tượng là một chuyên viên tư vấn có kiến thức, uy tín, đáng tin cậy.`,
    discoveryChecklist: [
      'Nơi ở và nơi làm việc hiện tại của khách hàng (để tư vấn quãng đường di chuyển thuận lợi).',
      'Quy mô gia đình (bao nhiêu thế hệ, có trẻ nhỏ hay người lớn tuổi không).',
      'Khách đã tìm hiểu những dự án lân cận nào trước đó chưa để nắm thị hiếu.'
    ],
    actionScript: `Em rất vui vì đã kết nối được với Anh/Chị [Tên Khách]! 

Với dự án [Tên Dự Án], hiện tại Chủ đầu tư đang mở bán giai đoạn 1 với quỹ căn đẹp nhất và chính sách thanh toán chỉ 1.5%/tháng. 

Để giúp Anh/Chị có cái nhìn tổng quan chuẩn xác nhất mà không mất nhiều thời gian, em sẽ gửi trọn bộ hồ sơ gồm: Mặt bằng tầng điển hình, thiết kế 3D căn hộ và Bảng dòng tiền thanh toán chi tiết từng đợt qua Zalo ngay cho Anh/Chị nhé!`,
    objectionHandling: `Nếu khách bảo "Cứ gửi tài liệu qua Zalo đi, có gì tôi xem sau":
-> "Dạ vâng chắc chắn rồi ạ! Em gửi ngay qua Zalo. Em chỉ xin phép đánh dấu riêng 2 căn có hướng ban công Đông Nam mát mẻ nhất để Anh/Chị không phải mất công lọc giữa hàng trăm căn ạ."`,
    nextStepCallToAction: 'Gửi Zalo trong vòng 3 phút sau cuộc gọi, kèm tin nhắn xác nhận đã gửi thành công.'
  },

  qualifying: {
    status: 'qualifying',
    stageName: 'Xác Định Nhu Cầu Sâu (Bộ Câu Hỏi BANT/SPIN)',
    categoryName: 'Nuôi dưỡng & Tư vấn',
    psychologyAnalysis: `Khách hàng bắt đầu cởi mở chia sẻ về bài toán của bản thân. 
Đây là bước quyết định để phân loại khách hàng tiềm năng: Khách nóng (mua trong 7 ngày), khách ấm (mua trong 30 ngày) hay khách lạnh (cần nuôi dưỡng lâu dài). 
Khách hàng ở bước này cần một chuyên gia am hiểu dòng tiền và bài toán tài chính chứ không phải một người đọc thuộc lòng brochure.`,
    discoveryChecklist: [
      'Budget (Ngân sách): Vốn tự có sẵn sàng là bao nhiêu? Có cần vay ngân hàng không?',
      'Authority (Quyền quyết định): Ai là người chốt quyết định cuối cùng trong gia đình?',
      'Need (Nhu cầu cốt lõi): Mua cho con đi học, mua cho thuê, hay mua tích sản chống lạm phát?',
      'Timeline (Thời gian): Thời điểm mong muốn nhận nhà hoặc thời điểm dòng tiền sẵn sàng giải ngân.'
    ],
    actionScript: `Dạ thưa Anh/Chị [Tên Khách], để giúp gia đình mình chọn đúng căn và tối ưu dòng tiền nhất, em xin phép hỏi nhanh 3 câu hỏi thực tế nhé:

1. Về tài chính: Hiện tại gia đình mình dự định sử dụng vốn tự có hay muốn tận dụng gói vay 70% ân hạn nợ gốc 0% lãi suất của ngân hàng Techcombank/MB Bank ạ?
2. Về không gian: Gia đình mình thích không gian 2 phòng ngủ ấm cúng hay cần căn 3 phòng ngủ để có phòng làm việc riêng cho mình?
3. Về tiêu chí ưu tiên: Điều gì quan trọng nhất đối với Anh/Chị: Tầm view thoáng, tầng phong thủy đẹp, hay bài toán tiến độ đóng tiền nhẹ nhàng nhất?`,
    objectionHandling: `Nếu khách ngại tiết lộ ngân sách:
-> "Dạ em hỏi ngân sách không phải để tính toán gì đâu ạ, mà vì dự án có nhiều chính sách: có căn thanh toán sớm chiết khấu tới 12%, có căn trả góp chỉ 15 triệu/tháng. Biết được bài toán của Anh/Chị em sẽ chọn đúng phương án có lợi nhất cho mình ạ!"`,
    nextStepCallToAction: 'Lập bảng phân tích dòng tiền cá nhân hóa theo đúng ngân sách của khách và gửi hẹn trao đổi.'
  },

  doc_sent: {
    status: 'doc_sent',
    stageName: 'Gửi Tài Liệu & Kích Hoạt Đọc (Tạo Điểm Chạm Giá Trị)',
    categoryName: 'Nuôi dưỡng & Tư vấn',
    psychologyAnalysis: `Khách hàng nhận được tài liệu nhưng thường bị ngập trong thông tin hoặc lười đọc file PDF dày đặc. 
Nếu sale chỉ gửi file mà không có hướng dẫn trọng tâm, khách sẽ quên lãng. 
Cần tạo ra "Trigger Hook" - một điểm nhấn hấp dẫn buộc khách phải mở tài liệu ra xem ngay lập tức.`,
    discoveryChecklist: [
      'Xác nhận khách đã mở file và xem được các trang trọng tâm chưa.',
      'Khách đánh giá thế nào về mật độ thang máy và layout căn hộ.',
      'Khách có thắc mắc gì về danh mục vật liệu bàn giao (Kohler, Hafele, Bosch...) không.'
    ],
    actionScript: `Dạ Anh/Chị [Tên Khách] ơi, em vừa gửi qua Zalo File PDF tóm tắt 3 trang quan trọng nhất của dự án [Tên Dự Án]:

- Trang 1: Mặt bằng tầng 8 view hồ cảnh quan (rất hiếm).
- Trang 2: Bảng tiến độ đóng tiền giãn 2 năm (mỗi tháng chỉ đóng 1.5%).
- Trang 3: Danh mục hoàn thiện nội thất cao cấp tiêu chuẩn Châu Âu.

Đặc biệt ở Trang 2, em có đánh dấu căn [Mã Căn] đang có chính sách tặng gói nội thất 100 triệu áp dụng riêng trong tuần này. Anh/Chị mở xem qua và cho em xin cảm nhận về hướng ban công căn này nhé!`,
    objectionHandling: `Nếu khách im lặng sau khi nhận tài liệu:
-> Nhắn tin sau 4 tiếng: "Dạ Anh/Chị [Tên Khách], em gửi thêm video quay thực tế từ flycam ở độ cao tầng 15 để Anh/Chị nhìn rõ tầm view hướng sông thực tế của căn hộ nhé ạ!"`,
    nextStepCallToAction: 'Theo dõi phản hồi trong vòng 6 - 12 tiếng, gọi điện thoại chốt lịch hẹn trải nghiệm sa bàn.'
  },

  appointment_set: {
    status: 'appointment_set',
    stageName: 'Đặt Lịch Hẹn Trực Tiếp (Nghệ Thuật Khóa Hẹn 2 Chọn 1)',
    categoryName: 'Nuôi dưỡng & Tư vấn',
    psychologyAnalysis: `Khách hàng nhận thấy dự án có tiềm năng và đồng ý dành thời gian gặp mặt. 
Tuy nhiên, họ có thể dễ dàng hủy hẹn nếu bận việc đột xuất hoặc cảm thấy buổi gặp không mang lại nhiều giá trị hơn việc đọc tài liệu ở nhà. 
Cần nâng cao vị thế của buổi hẹn: Trải nghiệm công nghệ 3D, xem sa bàn ánh sáng, nhận tư vấn pháp lý trực tiếp.`,
    discoveryChecklist: [
      'Khách đi một mình hay đi cùng người thân/vợ chồng/chuyên gia phong thủy?',
      'Khách tự túc phương tiện hay cần công ty bố trí xe đưa đón tận nhà?',
      'Thời điểm nào khách thoải mái nhất (sáng cuối tuần hay chiều thứ bảy)?'
    ],
    actionScript: `Dạ cuối tuần này Chủ đầu tư có tổ chức buổi trải nghiệm sa bàn quy hoạch và tham quan căn hộ mẫu thực tế của dự án [Tên Dự Án]. 

Đến trực tiếp Anh/Chị sẽ cảm nhận rõ ràng nhất về không gian sống, chiều cao trần, chất lượng cách âm và vị trí công viên thực tế.

Em có thể đăng ký tiếp đón Anh/Chị vào:
- Sáng Thứ Bảy lúc 9h30, hay 
- Chiều Chủ Nhật lúc 15h00 thì thuận tiện nhất cho lịch trình của gia đình mình ạ?`,
    objectionHandling: `Nếu khách phân vân: "Để cuối tuần xem bận gì không rồi báo lại sau nhé":
-> "Dạ vì cuối tuần lượng khách tham quan nhà mẫu rất đông, CĐT cần kiểm soát số lượng thẻ VIP vào cửa để phục vụ chu đáo nhất. Em xin phép giữ trước 1 suất hẹn sáng Thứ 7 cho mình, nếu sát ngày có thay đổi gì Anh/Chị chỉ cần nhắn em trước 1 tiếng là được ạ!"`,
    nextStepCallToAction: 'Gửi định vị nhà mẫu qua Zalo, gửi thiệp mời điện tử và nhắn tin nhắc hẹn trước 2 giờ.'
  },

  consulted: {
    status: 'consulted',
    stageName: 'Đã Gặp Tư Vấn Trực Tiếp (So Sánh & Củng Cố Lợi Thế)',
    categoryName: 'Nuôi dưỡng & Tư vấn',
    psychologyAnalysis: `Khách đã đến văn phòng hoặc quán cafe gặp sale, đã nghe thuyết trình chi tiết. 
Lúc này khách bắt đầu bước vào giai đoạn so sánh dự án với các dự án đối thủ khác trên thị trường. Họ muốn có thêm thời gian để cân nhắc nhưng cũng sợ bỏ lỡ căn đẹp.`,
    discoveryChecklist: [
      'Điều gì trong buổi tư vấn hôm nay khiến khách hàng hài lòng nhất?',
      'Khách còn lấn cấn điều gì về pháp lý, tiến độ bàn giao hay năng lực chủ đầu tư?',
      'Khách đang so sánh dự án này với dự án nào khác ngoài thị trường?'
    ],
    actionScript: `Em rất cảm ơn Anh/Chị [Tên Khách] đã dành thời gian quý báu đến tham quan và trao đổi cùng em hôm nay!

Đúng như Anh/Chị đã thấy trên sa bàn thực tế, căn góc [Mã Căn] là một trong số ít căn có tầm nhìn bao trọn công viên và đón trọn gió Đông Nam. 

Em đã tổng hợp lại 3 điểm cốt lõi mà hôm nay hai anh em mình thống nhất:
1. Giá bán đợt 1 thấp hơn thị trường xung quanh khoảng 5-7%.
2. Chính sách thanh toán 20% đến khi nhận nhà giúp mình bảo toàn dòng vốn kinh doanh.
3. Tiện ích trường học liên cấp ngay dưới chân tòa nhà rất tiện cho các bé.

Em gửi bản mềm bảng tính tài chính vào Zalo để Anh/Chị cùng bàn bạc thêm với gia đình tối nay nhé!`,
    objectionHandling: `Nếu khách nói: "Dự án bên cạnh giá rẻ hơn vài triệu/m2":
-> "Dạ đúng là đơn giá bên kia có vẻ thấp hơn một chút, nhưng bên em bàn giao full nội thất cao cấp liền tường và mật độ căn hộ chỉ 8 căn/sàn với 4 thang máy, tính ra diện tích sử dụng thực và giá trị sống đẳng cấp hơn rất nhiều ạ!"`,
    nextStepCallToAction: 'Theo dõi phản hồi vào sáng ngày hôm sau, đề xuất dẫn đi xem thực tế công trường.'
  },

  site_visit: {
    status: 'site_visit',
    stageName: 'Xem Dự Án Thực Địa (Kích Hoạt Cảm Xúc & Trực Giác)',
    categoryName: 'Nuôi dưỡng & Tư vấn',
    psychologyAnalysis: `Thực địa là bước có tác động cảm xúc mạnh mẽ nhất. 
Khách nhìn thấy cần cẩu thi công rầm rộ, công nhân làm việc, đường sá kết nối thực tế, tầm view từ trên cao. 
Tỷ lệ sẵn sàng xuống tiền ở bước này tăng vọt từ 40% lên 75%.`,
    discoveryChecklist: [
      'Khách đánh giá thế nào về hạ tầng kết nối xung quanh dự án khi đi thực tế?',
      'Cảm nhận của khách khi đứng tại vị trí căn hộ thực tế (hướng gió, ánh sáng, tầm nhìn)?',
      'Khách có bất ngờ về tiến độ xây dựng đang vượt kế hoạch không?'
    ],
    actionScript: `Dạ Anh/Chị đứng ngay vị trí này giúp em, đây chính là cao độ thực tế của căn hộ [Mã Căn] tầng 12 của mình!

Từ đây nhìn thẳng ra dòng sông và công viên trung tâm, hoàn toàn không bị tòa nhà nào che chắn tầm nhìn. Buổi chiều gió lộng cực kỳ mát mẻ, không cần bật điều hòa.

Anh/Chị có thể thấy tổng thầu Coteccons đang thi công đến tầng 16, vượt tiến độ cam kết 2 tháng. Hạ tầng tuyến đường vành đai trước mặt cũng đang được trải nhựa đồng bộ. Một không gian sống như thế này thực sự rất xứng đáng cho gia đình mình ạ!`,
    objectionHandling: `Nếu khách lo lắng: "Liệu tiến độ có kịp bàn giao quý 4 năm sau không em?":
-> "Dạ Anh/Chị yên tâm, dự án được ngân hàng Techcombank bảo lãnh tiến độ bằng văn bản pháp lý. Mỗi đợt thanh toán của khách hàng đều được giám sát chặt chẽ theo khối lượng thi công thực tế tại công trường ạ!"`,
    nextStepCallToAction: 'Chuyển ngay sang bước chốt phương án căn cụ thể và hướng dẫn thủ tục booking giữ chỗ.'
  },

  considering: {
    status: 'considering',
    stageName: 'Đang Cân Nhắc (Phá Vỡ Do Dự & Đòn Bẩy Quyết Định)',
    categoryName: 'Nuôi dưỡng & Tư vấn',
    psychologyAnalysis: `Khách hàng giằng xé tâm lý dữ dội: Thích dự án nhưng sợ mua hớ, sợ rủi ro thị trường, sợ lãi suất tăng, hoặc đang chờ người thân góp ý kiến. 
Nếu sale để khách "cân nhắc" quá 5 ngày mà không có lý do thúc đẩy, cảm xúc mua hàng sẽ nguội lạnh và deal sẽ mất. 
Cần dùng đòn bẩy giới hạn (FOMO) chính đáng: Quỹ căn đợt 1 sắp hết, chính sách ưu đãi sắp đóng.`,
    discoveryChecklist: [
      'Nỗi sợ lớn nhất lúc này của khách là gì: Giá cả, pháp lý, lãi suất hay tính thanh khoản?',
      'Ai đang là người đưa ra ý kiến phản biện trong gia đình khách hàng?',
      'Nếu giải quyết được khúc mắc này thì khách có sẵn sàng đặt cọc không?'
    ],
    actionScript: `Dạ em hiểu Anh/Chị [Tên Khách] cần thời gian tính toán kỹ lưỡng, vì mua nhà là việc lớn của cả gia đình. 

Tuy nhiên, em xin phép chia sẻ thật lòng với Anh/Chị: Căn [Mã Căn] mà gia đình mình ưng ý là căn hoa hậu của tầng 8. Hiện tại trên bảng hàng chỉ còn đúng 2 căn có view công viên này. 

Vào ngày Chủ Nhật tuần này, CĐT sẽ kết thúc chương trình Chiết khấu 8% và Gói bảo hiểm 50 triệu. Nếu bỏ lỡ đợt này sang đợt 2, cùng một căn hộ đó Anh/Chị sẽ phải trả thêm ít nhất 180 triệu. 

Em đề xuất phương án an toàn nhất: Anh/Chị làm thủ tục Booking giữ chỗ ưu tiên căn này trước. Booking có hoàn tiền 100%, mình vừa giữ được giá và quà tặng, vừa có thêm 3 ngày thảnh thơi bàn bạc cùng gia đình ạ!`,
    objectionHandling: `Nếu khách nói: "Để anh hỏi thêm ý kiến của bạn anh làm xây dựng/bất động sản":
-> "Dạ rất tuyệt vời ạ, người có chuyên môn xem qua sẽ thấy ngay chất lượng thi công và pháp lý bên em rất chuẩn chỉnh. Em gửi sẵn bộ hồ sơ pháp lý 1/500 và phụ lục vật liệu để bạn của Anh/Chị thẩm định giúp mình nhé!"`,
    nextStepCallToAction: 'Gửi link thanh toán booking giữ chỗ có hoàn lại để khách khóa quyền chọn căn.'
  },

  booking: {
    status: 'booking',
    stageName: 'Booking Giữ Chỗ (Khóa Suất Ưu Tiên Chọn Căn)',
    categoryName: 'Chốt giao dịch (Closing)',
    psychologyAnalysis: `Khách hàng đã vượt qua rào cản do dự và sẵn sàng chuyển 50 - 100 triệu để lấy số thứ tự ưu tiên. 
Họ cảm thấy an tâm vì chính sách hoàn cọc 100% nếu ngày mở bán không chọn được căn ưng ý. 
Sale cần hướng dẫn thanh toán chuyên nghiệp, rõ ràng từng bước để tạo sự tin tưởng tuyệt đối.`,
    discoveryChecklist: [
      'Mã căn ưu tiên số 1 và mã căn dự phòng số 2, số 3 của khách hàng.',
      'Khách đứng tên cá nhân hay đứng tên đồng sở hữu vợ chồng trên phiếu đăng ký.',
      'Khách thanh toán bằng hình thức chuyển khoản quét mã QR hay quẹt thẻ POS.'
    ],
    actionScript: `Dạ chúc mừng Anh/Chị [Tên Khách] đã đưa ra một quyết định rất kịp thời và sáng suốt!

Số thứ tự Booking [Số Booking] này sẽ giúp Anh/Chị được quyền ưu tiên chọn căn [Mã Căn] ngay khi giỏ hàng mở khóa. 

Em xin gửi thông tin tài khoản ngân hàng chính thức của Chủ đầu tư:
- Tên tài khoản: CÔNG TY CỔ PHẦN PHÁT TRIỂN [Tên CĐT]
- Số tài khoản: [Số TK Ngân Hàng]
- Ngân hàng: Techcombank - Chi nhánh Sài Gòn
- Số tiền: 50.000.000 VNĐ
- Cú pháp chuyển tiền: "[Họ Tên Khách] - Booking [Mã Căn] - [Tên Dự Án]"

Sau khi chuyển khoản thành công, Anh/Chị chụp lại màn hình giao dịch gửi em để em gửi Phiếu xác nhận điện tử có đóng dấu mộc đỏ về máy cho Anh/Chị nhé!`,
    objectionHandling: `Nếu khách lo lắng: "Lỡ hôm mở bán không chọn được căn thì bao lâu hoàn tiền lại?":
-> "Dạ theo quy định bằng văn bản của CĐT, nếu ngày mở bán Anh/Chị không chọn được căn hoặc không ưng ý giá, toàn bộ 50 triệu sẽ được hoàn trả về đúng số tài khoản của Anh/Chị trong vòng 3 - 5 ngày làm việc, hoàn toàn không mất bất kỳ chi phí nào ạ!"`,
    nextStepCallToAction: 'Xác nhận tiền đã vào tài khoản CĐT, xuất phiếu Booking có dấu mộc và chuẩn bị cho ngày mở bán.'
  },

  deposit: {
    status: 'deposit',
    stageName: 'Đặt Cọc Chính Thức (Chuyển Cọc Chết & Khóa Căn)',
    categoryName: 'Chốt giao dịch (Closing)',
    psychologyAnalysis: `Khoảnh khắc bùng nổ cảm xúc của cả sale và khách hàng. Khách chính thức chuyển từ Booking có hoàn sang Đặt cọc không hoàn lại. 
Khách hàng vừa vui mừng vì sở hữu được tài sản ưng ý, vừa có chút hồi hộp về các thủ tục ký kết hợp đồng sắp tới. 
Sale cần chúc mừng nhiệt liệt và đồng hành chặt chẽ để củng cố niềm tin.`,
    discoveryChecklist: [
      'Xác nhận lại chính xác căn tầng, diện tích tim tường/thông thủy và giá trị giao dịch cuối cùng.',
      'Xác nhận gói chính sách khách lựa chọn: Chiết khấu thanh toán nhanh hay gói vay ưu đãi lãi suất.',
      'Hẹn ngày chuẩn bị hồ sơ pháp lý nhân thân để lên ký HĐMB trong vòng 7 ngày.'
    ],
    actionScript: `Dạ em xin chúc mừng Anh/Chị [Tên Khách]! 

Hệ thống Chủ đầu tư vừa vang chuông chúc mừng và khóa căn thành công:
- Dự án: [Tên Dự Án]
- Mã căn: [Mã Căn] - Tầng [Số Tầng]
- Giá trị giao dịch: [Giá Trị Hợp Đồng] VNĐ
- Khoản tiền cọc: 100.000.000 VNĐ đã được khớp thành công!

Căn hộ này từ giây phút này đã chính thức thuộc quyền sở hữu của Anh/Chị! Em xin gửi Biên bản thỏa thuận đặt cọc có chữ ký điện tử. Trong vòng 7 ngày tới, em sẽ cùng Anh/Chị hoàn thiện hồ sơ để tiến hành ký kết Hợp Đồng Mua Bán chính thức ạ!`,
    objectionHandling: `Nếu khách lo lắng thủ tục vay ngân hàng:
-> "Dạ chuyên viên tín dụng ngân hàng Techcombank phụ trách dự án đã thẩm định sơ bộ hồ sơ của mình rồi ạ. Hồ sơ thu nhập của gia đình mình rất đẹp, ngân hàng cam kết cấp thư đồng ý cho vay trong vòng 48 giờ tới nên Anh/Chị hoàn toàn yên tâm nhé!"`,
    nextStepCallToAction: 'Giao phiếu cọc tận tay khách hàng, lập checklist hồ sơ cần chuẩn bị cho ngày ký HĐMB.'
  },

  contract: {
    status: 'contract',
    stageName: 'Ký Hợp Đồng Mua Bán (Thanh Toán Đợt 1 & Pháp Lý Hoàn Tất)',
    categoryName: 'Chốt giao dịch (Closing)',
    psychologyAnalysis: `Khách hàng chính thức ký tên lên bộ HĐMB dày hàng chục trang và thanh toán 10-15% đợt 1. 
Họ cảm thấy tự hào, viên mãn vì đã sở hữu tài sản lớn. Họ mong muốn mọi điều khoản pháp lý, tiến độ bàn giao và trách nhiệm bảo hành phải tuyệt đối minh bạch.`,
    discoveryChecklist: [
      'So soát kỹ thông tin cá nhân: Họ tên, ngày sinh, số CCCD, địa chỉ thường trú trên hợp đồng.',
      'Kiểm tra phụ lục trang thiết bị bàn giao đúng chuẩn cam kết ban đầu.',
      'Hỗ trợ khách hàng lấy phiếu thu đợt 1 và hóa đơn VAT điện tử.'
    ],
    actionScript: `Em xin chúc mừng Anh/Chị [Tên Khách] đã chính thức đặt bút ký kết Hợp Đồng Mua Bán căn hộ [Mã Căn] tại dự án [Tên Dự Án] hôm nay!

Em đã cùng bộ phận pháp lý rà soát chi tiết từng điều khoản hợp đồng, phụ lục vật liệu và tiến độ thi công, tất cả đều chuẩn xác 100% theo quy định của Luật Kinh doanh BĐS.

Em xin gửi tặng gia đình một món quà tri ân chúc mừng tân gia từ công ty Địa Ốc Vàng. Em sẽ là người quản lý hợp đồng của Anh/Chị xuyên suốt quá trình xây dựng cho tới ngày nhận bàn giao chìa khóa nhà ạ!`,
    objectionHandling: `Nếu khách băn khoăn về điều khoản bàn giao trễ hạn:
-> "Dạ trong Điều 12 của HĐMB có ghi rất rõ: Nếu CĐT bàn giao trễ quá 90 ngày sẽ phải chịu phạt lãi suất 1.5%/tháng trên số tiền khách đã đóng. Nếu trễ quá 180 ngày, khách hàng có quyền đơn phương chấm dứt hợp đồng và được hoàn tiền kèm tiền phạt vi phạm hợp đồng ạ."`,
    nextStepCallToAction: 'Lưu trữ hồ sơ hợp đồng, bàn giao bản sao lưu cho khách, chuyển sang quy trình chăm sóc sau bán.'
  },

  after_sales: {
    status: 'after_sales',
    stageName: 'Chăm Sóc Sau Bán Hàng (Nuôi Dưỡng & Khai Thác Khách Giới Thiệu)',
    categoryName: 'Chăm sóc sau bán',
    psychologyAnalysis: `Khách hàng đã mua và đang chờ ngày nhận nhà. 
Họ rất muốn biết tiến độ xây dựng định kỳ, các tiện ích xung quanh hình thành ra sao. 
Khách hàng ở giai đoạn này nếu được chăm sóc chu đáo sẽ trở thành đại sứ thương hiệu nhiệt thành nhất, giới thiệu người thân, bạn bè mua cùng (Referral) hoàn toàn miễn phí.`,
    discoveryChecklist: [
      'Gửi cập nhật tiến độ thi công công trường định kỳ mỗi tháng 1 lần bằng hình ảnh/video chất lượng cao.',
      'Nắm bắt ngày sinh nhật của khách và các dịp Lễ/Tết để gửi lời chúc và quà tặng nhỏ.',
      'Thăm dò xem người thân, bạn bè hoặc đồng nghiệp của khách có ai đang quan tâm phân khúc tương tự không.'
    ],
    actionScript: `Dạ em chào Anh/Chị [Tên Khách]! 

Em xin gửi Anh/Chị video Flycam tiến độ xây dựng dự án [Tên Dự Án] tuần này ạ: Toà tháp của mình hiện đã xây lên tầng 22, các tiện ích hồ bơi và công viên nội khu cũng đang được triển khai phần móng rất khẩn trương.

Nhân dịp tháng này Chủ đầu tư có chương trình "Tri ân cư dân: Giới thiệu người thân - Nhận ngay chiết khấu 1.5% và quà tặng 2 cây vàng", nếu bạn bè hoặc người thân của Anh/Chị có ai đang tìm nhà để về làm hàng xóm cùng mình, Anh/Chị giới thiệu giúp em nhé! Em xin cam kết sẽ tư vấn và hỗ trợ nhiệt tình, chu đáo nhất ạ!`,
    objectionHandling: `Nếu khách hỏi về thủ tục chuyển nhượng thứ cấp:
-> "Dạ sau khi nhận HĐMB và thanh toán đủ đợt 1, mình hoàn toàn có quyền chuyển nhượng sinh lời trên thị trường thứ cấp. Em sẽ hỗ trợ Anh/Chị toàn bộ thủ tục công chứng, khai thuế và tìm khách mua với giá tốt nhất thị trường ạ!"`,
    nextStepCallToAction: 'Duy trì tương tác mỗi tháng ít nhất 1 lần, mở lời xin lời giới thiệu khách hàng mới.'
  },

  lost: {
    status: 'lost',
    stageName: 'Thất Bại / Đóng Lead (Ứng Xử Đẳng Cấp & Tái Kích Hoạt Tương Lai)',
    categoryName: 'Đóng / Dừng chăm sóc',
    psychologyAnalysis: `Khách hàng quyết định không mua dự án này vì không đủ tiền, gia đình không đồng thuận, hoặc đã mua một dự án khác. 
Khách thường ngại ngùng hoặc cảm thấy có lỗi với sale vì đã tư vấn nhiều. 
Sale ứng xử văn minh, tôn trọng và chân thành ở bước này sẽ tạo ấn tượng sâu sắc, biến khách hàng thành khách mua ở dự án tiếp theo.`,
    discoveryChecklist: [
      'Ghi nhận trung thực nguyên nhân thất bại: Do giá cao, do pháp lý, do vị trí, hay do thiếu hụt tài chính?',
      'Nếu khách mua dự án khác: Dự án nào đã thuyết phục được khách và điểm mấu chốt là gì?',
      'Lưu thông tin nhu cầu vào kho Nurture Pool để tái kích hoạt khi có dự án mới phù hợp hơn.'
    ],
    actionScript: `Dạ em chào Anh/Chị [Tên Khách], 

Em rất cảm ơn Anh/Chị trong suốt thời gian qua đã luôn cởi mở, lắng nghe và tạo cơ hội cho em được tư vấn hỗ trợ. 

Dù đợt này dự án [Tên Dự Án] chưa hoàn toàn phù hợp với kế hoạch và tiêu chí của gia đình mình, em vẫn vô cùng trân trọng cơ duyên được quen biết và đồng hành cùng Anh/Chị. 

Em xin phép lưu lại số điện thoại và tiêu chuẩn của mình. Sắp tới nếu công ty em có dự án mới ở khu vực [Khu vực mong muốn] với mức giá và tiến độ thanh toán phù hợp hơn, em xin phép gửi thông tin để Anh/Chị tham khảo thêm nhé ạ.

Chúc Anh/Chị và gia đình luôn dồi dào sức khỏe, may mắn và sớm chọn được chốn an cư thật ưng ý ạ!`,
    objectionHandling: `Nếu khách nhắn lại cảm ơn và khen ngợi sự nhiệt tình:
-> "Dạ sự hài lòng và tin tưởng của Anh/Chị là niềm vui lớn nhất của em trong nghề môi giới BĐS ạ. Bất cứ khi nào gia đình cần tham khảo thị trường hay thủ tục pháp lý nhà đất, Anh/Chị cứ nhắn em bất cứ lúc nào nhé!"`,
    nextStepCallToAction: 'Phân loại nguyên nhân mất deal trên hệ thống, lên lịch nhắc hẹn 60 ngày sau để hỏi thăm tái kích hoạt.'
  }
};

export const formatFullScriptMarkdown = (detail: StageScriptDetail, projectName: string = 'Dự Án Bất Động Sản'): string => {
  return `# KỊCH BẢN TƯ VẤN THỰC CHIẾN: ${detail.stageName.toUpperCase()}
Dự án: **${projectName}** • Phân nhóm: **${detail.categoryName}**
---

## I. PHÂN TÍCH TÂM LÝ & BỐI CẢNH KHÁCH HÀNG
${detail.psychologyAnalysis}

---

## II. NỘI DUNG TÌM HIỂU & BỘ CÂU HỎI KHAI THÁC NHU CẦU
${detail.discoveryChecklist.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}

---

## III. KỊCH BẢN TƯ VẤN THỰC CHIẾN & LỜI THOẠI MẪU CHO SALE
${detail.actionScript}

---

## IV. XỬ LÝ TÌNH HUỐNG & TỪ CHỐI ĐIỂN HÌNH
${detail.objectionHandling}

---

## V. HÀNH ĐỘNG KẾ TIẾP (CALL-TO-ACTION)
> **Mục tiêu tiếp theo**: ${detail.nextStepCallToAction}
`;
};
