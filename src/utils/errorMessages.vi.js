/** Nhãn tiếng Việt cho tên trường API (camelCase). */
const FIELD_LABELS = Object.freeze({
  email: 'Email',
  password: 'Mật khẩu',
  otp: 'Mã OTP',
  token: 'Token',
  newPassword: 'Mật khẩu mới',
  currentPassword: 'Mật khẩu hiện tại',
  fullName: 'Họ và tên',
  phone: 'Số điện thoại',
  role: 'Vai trò',
  tenantId: 'Tenant',
  warehouseId: 'Kho',
  contractId: 'Hợp đồng',
  contractCode: 'Mã hợp đồng',
  contractType: 'Loại hợp đồng',
  pricingModel: 'Mô hình giá',
  startDate: 'Ngày bắt đầu',
  endDate: 'Ngày kết thúc',
  expectedStartDate: 'Ngày bắt đầu dự kiến',
  expectedEndDate: 'Ngày kết thúc dự kiến',
  inboundRequestId: 'Yêu cầu nhập kho',
  outboundRequestId: 'Yêu cầu xuất kho',
  outboundRequestItemId: 'Dòng hàng xuất kho',
  requestedQuantity: 'Số lượng yêu cầu xuất',
  skuId: 'SKU',
  lpnId: 'LPN',
  binId: 'Bin',
  zoneId: 'Zone',
  rackId: 'Kệ',
  rackLevelId: 'Tầng kệ',
  batchCode: 'Mã batch',
  vehiclePlate: 'Biển số xe',
  assignedDriverUserId: 'Tài xế được gán',
  deliveryMode: 'Hình thức vận chuyển',
  requestCode: 'Mã yêu cầu',
  warehouseCode: 'Mã kho',
  warehouseName: 'Tên kho',
  zoneCode: 'Mã zone',
  reservationType: 'Loại reservation',
  storageLevel: 'Cấp lưu trữ',
  itemType: 'Loại hạng mục',
  billingUnit: 'Đơn vị tính phí',
  unitPrice: 'Đơn giá',
  expectedQuantity: 'Số lượng dự kiến',
  quantity: 'Số lượng',
  city: 'Thành phố',
  district: 'Quận/huyện',
});

/** Thông báo cố định — khớp chính xác chuỗi gốc. */
const EXACT = Object.freeze({
  'Authentication required': 'Yêu cầu đăng nhập',
  'Invalid or expired token': 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
  'User not found or inactive': 'Tài khoản không tồn tại hoặc đã bị khóa',
  'Insufficient permissions': 'Bạn không có quyền thực hiện thao tác này',
  Forbidden: 'Không có quyền truy cập',
  'Forbidden: warehouse out of scope': 'Không có quyền truy cập kho này',
  'Forbidden: tenant out of scope': 'Không có quyền truy cập tenant này',
  'Forbidden: rental request out of tenant scope': 'Yêu cầu thuê không thuộc phạm vi tenant của bạn',
  'Forbidden: warehouse inbox not available for tenant users': 'Tenant không thể truy cập hộp thư kho',
  'Forbidden: no contract with this warehouse': 'Không có hợp đồng với kho này',
  'Internal server error': 'Lỗi máy chủ nội bộ',
  'Related resource not found or invalid reference': 'Dữ liệu liên quan không tồn tại hoặc tham chiếu không hợp lệ',
  'Invalid identifier format': 'Định dạng mã định danh không hợp lệ',
  'email and password are required': 'Email và mật khẩu là bắt buộc',
  'Invalid email or password': 'Email hoặc mật khẩu không đúng',
  'Account is not active': 'Tài khoản chưa được kích hoạt',
  'Password must be at least 8 characters': 'Mật khẩu phải có ít nhất 8 ký tự',
  'phone must not be an email address': 'Số điện thoại không được là địa chỉ email',
  'phone is invalid': 'Số điện thoại không hợp lệ (vd: 0901234567)',
  'User not found': 'Không tìm thấy người dùng',
  'Current password is incorrect': 'Mật khẩu hiện tại không đúng',
  'currentPassword and newPassword are required': 'Mật khẩu hiện tại và mật khẩu mới là bắt buộc',
  'New password must differ from current password': 'Mật khẩu mới phải khác mật khẩu hiện tại',
  'User has no email configured — cannot send OTP': 'Tài khoản chưa có email — không thể gửi OTP',
  'No pending password change. Request OTP again.': 'Chưa có yêu cầu đổi mật khẩu. Vui lòng gửi lại OTP.',
  'OTP expired. Request a new one.': 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.',
  'Too many wrong attempts. Request a new OTP.': 'Nhập sai quá nhiều lần. Vui lòng yêu cầu mã OTP mới.',
  'Invalid or expired reset link': 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
  'Warehouse not found': 'Không tìm thấy kho',
  'Tenant not found': 'Không tìm thấy tenant',
  'Contract not found': 'Không tìm thấy hợp đồng',
  'Rental request not found': 'Không tìm thấy yêu cầu thuê',
  'Inbound request not found': 'Không tìm thấy yêu cầu nhập kho',
  'Inbound request item not found': 'Không tìm thấy dòng hàng nhập kho',
  'Inbound delivery not found': 'Không tìm thấy thông tin vận chuyển',
  'Outbound request not found': 'Không tìm thấy yêu cầu xuất kho',
  'Outbound request item not found': 'Không tìm thấy dòng hàng xuất kho',
  'skuId does not belong to this outbound tenant': 'SKU không thuộc tenant của phiếu xuất',
  'Cannot modify items on outbound in current status':
    'Không thể sửa dòng hàng khi phiếu xuất ở trạng thái hiện tại',
  'Outbound request must have at least one line item (SKU + quantity)':
    'Phiếu xuất phải có ít nhất một dòng (SKU và số lượng)',
  'This SKU is already on the outbound request; update quantity instead':
    'SKU đã có trên phiếu xuất; hãy cập nhật số lượng thay vì thêm dòng mới',
  'Contract must be ACTIVE to create an outbound request':
    'Hợp đồng phải ACTIVE mới tạo được yêu cầu xuất kho',
  'Batch not found': 'Không tìm thấy batch',
  'Zone not found': 'Không tìm thấy zone',
  'Collection not found': 'Không tìm thấy collection',
  'Shipment not found': 'Không tìm thấy lô giao hàng',
  'Inventory not found': 'Không tìm thấy tồn kho',
  'LPN detail not found': 'Không tìm thấy chi tiết LPN',
  'Contract item not found': 'Không tìm thấy hạng mục hợp đồng',
  'Storage reservation not found': 'Không tìm thấy reservation',
  'AI slot recommendation not found': 'Không tìm thấy gợi ý vị trí AI',
  'Delivery record not found for this trip': 'Không tìm thấy thông tin chuyến vận chuyển',
  'No valid fields to update': 'Không có trường hợp lệ để cập nhật',
  'endDate must be after startDate': 'Ngày kết thúc phải sau ngày bắt đầu',
  'Contract must be ACTIVE to create an inbound request': 'Hợp đồng phải ACTIVE mới tạo được yêu cầu nhập kho',
  'contractId does not belong to this tenant': 'Hợp đồng không thuộc tenant này',
  'contractId does not belong to this warehouse': 'Hợp đồng không thuộc kho này',
  'tenantId does not match outbound request': 'Tenant không khớp với yêu cầu xuất kho',
  'skuId does not belong to this inbound tenant': 'SKU không thuộc tenant của phiếu nhập',
  'skuId does not belong to the same tenant as LPN': 'SKU không cùng tenant với LPN',
  'Collection name already exists for this tenant': 'Tên collection đã tồn tại trong tenant này',
  'LPN already has inventory records (already put away)': 'LPN đã được putaway',
  'Bin is blocked': 'Bin đang bị khóa',
  'Bin volume capacity exceeded': 'Bin vượt quá dung tích cho phép',
  'Bin LPN count capacity exceeded': 'Bin vượt quá số LPN cho phép',
  'vehiclePlate is required': 'Biển số xe là bắt buộc',
  'vehiclePlate is too long': 'Biển số xe quá dài',
  'Vehicle plate is required before marking arrival. Save inbound delivery info first.':
    'Cần lưu biển số xe trước khi đánh dấu xe đã đến',
  'Trip is not assigned to you': 'Chuyến này chưa được gán cho bạn',
  'This inbound is not warehouse transport': 'Phiếu nhập không dùng vận chuyển của kho',
  'Tenant cannot edit warehouse transport delivery': 'Tenant không thể sửa thông tin vận chuyển của kho',
  'Transporter account is not active': 'Tài khoản tài xế chưa được kích hoạt',
  'Transporter does not belong to this warehouse': 'Tài xế không thuộc kho này',
  'assignedDriverUserId must be a WH_TRANSPORTER user': 'Tài xế được gán phải có role WH_TRANSPORTER',
  'Transporter already has an active trip': 'Tài xế đang có chuyến vận chuyển chưa hoàn thành',
  'Use transporter delivery update for this role': 'Vui lòng dùng luồng cập nhật dành cho tài xế',
  'Transporter cannot reassign driver': 'Tài xế không thể tự gán lại người khác',
  'WH_TRANSPORTER only': 'Chỉ tài xế kho mới thực hiện được thao tác này',
  'Warehouse transport pickup must be reported by the assigned transporter':
    'Inbound kho đi lấy — chỉ tài xế được gán mới báo đã lấy hàng',
  'Warehouse transport arrivals must be reported by the assigned transporter':
    'Inbound kho đi lấy — chỉ tài xế được gán mới báo xe đã đến kho',
  'pickupAddress is required before reporting pickup':
    'Cần có điểm lấy hàng trước khi báo đã lấy hàng',
  'assignedToMe requires WH_TRANSPORTER': 'Chỉ tài xế kho mới dùng được bộ lọc assignedToMe',
  'assignedPickerMe requires WH_STAFF': 'Chỉ nhân viên kho mới dùng được bộ lọc assignedPickerMe',
  'assignedPickerUserId is required when approving outbound':
    'Phải chọn nhân viên pick (assignedPickerUserId) khi duyệt phiếu xuất',
  'assignedPickerUserId is required when reserving outbound':
    'Phải chọn nhân viên pick (assignedPickerUserId) khi reserve phiếu xuất',
  'assignedPickerUserId must be a WH_STAFF user':
    'assignedPickerUserId phải là tài khoản WH_STAFF',
  'Picker account is not active': 'Tài khoản nhân viên pick chưa được kích hoạt',
  'Picker does not belong to this warehouse': 'Nhân viên pick không thuộc kho này',
  'No picker assigned to this outbound': 'Phiếu xuất chưa được gán nhân viên pick',
  'Outbound pick is not assigned to you': 'Phiếu pick này không được gán cho bạn',
  'Only assigned warehouse staff can perform picking':
    'Chỉ nhân viên kho được gán mới thực hiện pick',
  'Only warehouse admin can approve outbound': 'Chỉ quản trị kho mới duyệt phiếu xuất',
  'Only warehouse admin can reserve inventory': 'Chỉ quản trị kho mới reserve tồn cho phiếu xuất',
  'Only warehouse admin can assign picker': 'Chỉ quản trị kho mới gán nhân viên pick',
  'Only warehouse admin can ship outbound': 'Chỉ quản trị kho mới xuất hàng (duyệt packing)',
  'Only warehouse admin can complete outbound': 'Chỉ quản trị kho mới hoàn tất phiếu xuất',
  'Picker can only be assigned when outbound is RESERVED':
    'Chỉ gán picker khi phiếu ở trạng thái RESERVED',
  'Cannot reassign picker after picking has started':
    'Không thể đổi nhân viên pick sau khi đã bắt đầu pick',
  'This outbound is not warehouse transport': 'Phiếu xuất này không phải hình thức kho giao ra',
  'Outbound delivery trip is only active after SHIPPED':
    'Chuyến giao outbound chỉ hoạt động sau khi phiếu SHIPPED',
  'Assign transporter after outbound is SHIPPED (inventory deducted)':
    'Gán tài xế sau khi phiếu SHIPPED (đã trừ tồn)',
  'shipToAddress is required for warehouse transport before shipping':
    'Cần địa chỉ giao hàng trước khi xuất kho (kho giao ra)',
  'vehiclePlate is required for tenant self pickup before shipping':
    'Cần biển số xe trước khi xuất kho (tenant tự lấy)',
  'Save tenant vehicle info on delivery before shipping':
    'Lưu biển số xe trước khi WH Admin xuất hàng',
  'Only WAREHOUSE_TRANSPORT outbound supports driver assignment':
    'Chỉ phiếu kho giao ra mới gán tài xế',
  'Delivery record not found — ship outbound first': 'Chưa có bản ghi giao hàng — xuất hàng trước',
  'Cannot change assignment after pickup has started':
    'Không đổi tài xế sau khi đã lấy hàng khỏi kho',
  'Transporter already has an active outbound trip': 'Tài xế đang có chuyến giao outbound chưa xong',
  'Save vehicle plate before reporting pickup': 'Lưu biển số xe trước khi báo lấy hàng',
  'shipToAddress is required before reporting pickup': 'Cần địa chỉ giao trước khi báo lấy hàng',
  'shipToAddress is required': 'Địa chỉ giao hàng là bắt buộc',
  'shipToContactName is required': 'Tên người nhận là bắt buộc',
  'shipToContactPhone is required': 'SĐT người nhận là bắt buộc',
  'Tenant can only update delivery info before warehouse processing':
    'Tenant chỉ sửa thông tin giao hàng khi phiếu còn PENDING/DRAFT',
  'SYSTEM_ADMIN only': 'Chỉ System Admin mới thực hiện được thao tác này',
  'Cannot reactivate blocked user': 'Không thể kích hoạt lại tài khoản đã bị khóa',
  'Cannot deactivate your own account': 'Không thể tự vô hiệu hóa tài khoản của chính bạn',
  'Creator has no warehouse scope': 'Người tạo không có phạm vi kho',
  'Creator has no tenant scope': 'Người tạo không có phạm vi tenant',
  'Cannot assign a different warehouse': 'Không thể gán kho khác',
  'Cannot assign a different tenant': 'Không thể gán tenant khác',
  'tenantId is not allowed for warehouse roles': 'Không được gán tenantId cho role kho',
  'warehouseId is not allowed for tenant roles': 'Không được gán warehouseId cho role tenant',
  'warehouseId is required for warehouse users': 'warehouseId là bắt buộc cho user kho',
  'tenantId is required for tenant users': 'tenantId là bắt buộc cho user tenant',
  'expectedStartDate is required': 'Ngày bắt đầu dự kiến là bắt buộc',
  'expectedEndDate is required': 'Ngày kết thúc dự kiến là bắt buộc',
  'contractType is not billable': 'Loại hợp đồng không tính phí được',
  'items array is required': 'Danh sách items là bắt buộc',
  'count must be between 1 and 50': 'Số lượng phải từ 1 đến 50',
  'areaM2PerZone must be a positive number': 'Diện tích m²/zone phải là số dương',
  'zoneCode is required for each zone': 'Mỗi zone cần có mã zone',
  'fillPercentage must be between 0 and 100': 'Tỷ lệ lấp đầy phải từ 0 đến 100',
  'weightKg must be a non-negative number': 'Khối lượng (kg) phải là số không âm',
  'volumeUnits must be a positive integer': 'Volume units phải là số nguyên dương',
  'LPN has no tenantId': 'LPN chưa có tenantId',
  'Ollama is disabled (OLLAMA_ENABLED=false)': 'Tính năng AI đang tắt',
  'Ollama returned an empty response': 'AI không trả về kết quả',
  'city and district query params are required': 'Tham số city và district là bắt buộc',
  'inboundRequestId query parameter is required': 'Tham số inboundRequestId là bắt buộc',
  'expectedEndDate must be after expectedStartDate': 'Ngày kết thúc phải sau ngày bắt đầu',
  'city and district must be a valid pair from the location catalog':
    'Thành phố và quận/huyện phải khớp danh mục địa điểm',
  'Rental request already claimed by another warehouse': 'Yêu cầu thuê đã được kho khác nhận',
  'Rental request is already linked to another contract':
    'Yêu cầu thuê đã có hợp đồng — tiếp tục với hợp đồng hiện có.',
  'Warehouse region does not match rental request city/district':
    'Khu vực kho không khớp thành phố/quận của yêu cầu thuê',
  'Cannot approve rental request (invalid status or region mismatch)':
    'Không thể duyệt yêu cầu thuê (trạng thái hoặc khu vực không hợp lệ)',
  'warehouseId is required when approving a regional rental request':
    'Cần chọn kho khi duyệt yêu cầu thuê theo khu vực',
  'Unclaimed rental request can only be APPROVED (with warehouseId) or REJECTED':
    'Yêu cầu chưa claim chỉ có thể DUYỆT (kèm warehouseId) hoặc TỪ CHỐI',
  'Warehouse must have city and district configured for regional rental requests':
    'Kho cần cấu hình thành phố và quận/huyện để nhận yêu cầu thuê theo khu vực',
});

function labelField(name) {
  return FIELD_LABELS[name] ?? name;
}

function translateFieldList(list) {
  return list
    .split(',')
    .map((s) => s.trim())
    .map((f) => labelField(f))
    .join(', ');
}

/**
 * Chuyển thông báo lỗi API sang tiếng Việt (nếu có bản dịch).
 * Giữ nguyên chuỗi đã là tiếng Việt hoặc chưa có mapping.
 */
export function toVietnameseErrorMessage(message) {
  if (!message || typeof message !== 'string') return message;

  const trimmed = message.trim();
  if (EXACT[trimmed]) return EXACT[trimmed];

  // Đã có ký tự tiếng Việt → giữ nguyên
  if (/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(trimmed)) {
    return trimmed;
  }

  let m;

  m = trimmed.match(/^Route not found: (.+)$/);
  if (m) return `Không tìm thấy API: ${m[1]}`;

  m = trimmed.match(/^Invalid (.+)\. Allowed values: (.+)$/);
  if (m) return `${labelField(m[1])} không hợp lệ. Giá trị cho phép: ${m[2]}`;

  m = trimmed.match(/^Invalid (.+)$/);
  if (m) return `${labelField(m[1])} không hợp lệ`;

  m = trimmed.match(/^(.+) is required$/);
  if (m) return `${labelField(m[1])} là bắt buộc`;

  m = trimmed.match(/^(.+) is not a valid date-time$/);
  if (m) return `${labelField(m[1])} không phải ngày giờ hợp lệ`;

  m = trimmed.match(/^(.+) is not a valid date$/);
  if (m) return `${labelField(m[1])} không phải ngày hợp lệ`;

  m = trimmed.match(/^(.+) cannot be empty$/);
  if (m) return `${labelField(m[1])} không được để trống`;

  m = trimmed.match(/^(.+) query is required$/);
  if (m) return `Tham số ${labelField(m[1])} là bắt buộc`;

  m = trimmed.match(/^(.+) query parameter is required$/);
  if (m) return `Tham số ${labelField(m[1])} là bắt buộc`;

  m = trimmed.match(/^(.+) not found$/i);
  if (m) return `Không tìm thấy ${labelField(m[1])}`;

  m = trimmed.match(/^Role (.+) cannot create user with role (.+)$/);
  if (m) return `Role ${m[1]} không thể tạo user với role ${m[2]}`;

  m = trimmed.match(/^Incorrect OTP\. (\d+) attempt\(s\) left\.$/);
  if (m) return `Mã OTP không đúng. Còn ${m[1]} lần thử.`;

  m = trimmed.match(/^Failed to send OTP email: (.+)$/);
  if (m) return `Không gửi được email OTP: ${m[1]}`;

  m = trimmed.match(/^Cannot update delivery info when inbound status is (.+)$/);
  if (m) return `Không thể cập nhật vận chuyển khi trạng thái inbound là ${m[1]}`;

  m = trimmed.match(/^Cannot report pickup when inbound status is (.+)$/);
  if (m) return `Không thể báo đã lấy hàng khi trạng thái inbound là ${m[1]}`;

  m = trimmed.match(/^Cannot report arrival when inbound status is (.+)$/);
  if (m) return `Không thể báo đến kho khi trạng thái inbound là ${m[1]}`;

  m = trimmed.match(/^Transporter already has an active trip \((.+)\)$/);
  if (m) {
    return `Tài xế đang có chuyến chưa hoàn thành (${m[1]}). Chọn tài xế khác hoặc chờ tài xế báo xe đến kho.`;
  }

  m = trimmed.match(/^vehiclePlate or assignedDriverUserId is required$/);
  if (m) return 'Cần nhập biển số xe hoặc chọn tài xế được gán';

  m = trimmed.match(/^(.+) must be a non-negative integer$/);
  if (m) return `${labelField(m[1])} phải là số nguyên không âm`;

  m = trimmed.match(/^(.+) must be a non-negative number$/);
  if (m) return `${labelField(m[1])} phải là số không âm`;

  m = trimmed.match(/^(.+) does not belong to (.+)$/);
  if (m) return `${labelField(m[1])} không thuộc ${labelField(m[2])}`;

  m = trimmed.match(
    /^Insufficient inventory for SKU \(available: (\d+), requested: (\d+)\)$/
  );
  if (m) {
    return `Không đủ tồn kho cho SKU (còn: ${m[1]}, yêu cầu: ${m[2]})`;
  }

  m = trimmed.match(
    /^Insufficient inventory for SKU \(available: (\d+), requested: (\d+), already committed on other outbound lines: (\d+)\)$/
  );
  if (m) {
    return `Không đủ tồn kho cho SKU (còn: ${m[1]}, tổng yêu cầu: ${m[2]}, đã cam kết trên phiếu xuất khác: ${m[3]})`;
  }

  return trimmed;
}
