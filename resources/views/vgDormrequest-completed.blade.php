<!DOCTYPE html>
<html>
<head>
<style>
    table {
      border: 2px solid black;
      border-collapse: collapse;
    }

    table th {
      color: #000000;
      background-color: #ff9800;
      font-weight: bold;
      border: 1px solid black;
      border-collapse: collapse;
      padding: 8px;
      white-space: nowrap;
    }

    table td {
      border: 1px solid black;
      border-collapse: collapse;
      padding: 8px;
      white-space: nowrap;
    }
  </style>
</head>
<body>
    <p>Dear Mrs/Mr {{ $name }},</p>
    <p>Đơn đăng ký của bạn đã được phê duyệt hoàn tất/您的申請已完成審批:</p>
    <p>Bộ phận/部门: {{ $dept }}</p>
    <p class="highlight">Trạng thái: Hoàn thành/狀態：完成</p>
    
    @if(isset($occupants) && count($occupants) > 0)
    <div class="table-wrapper">
        <table>
            <tr>
                <th>Thông tin / 資訊</th>
                @foreach($occupants as $index => $occupant)
                    <th>Người {{ $index + 1 }} / 第{{ $index + 1 }}人</th>
                @endforeach
            </tr>
            <tr>
                <td>Name / 名字</td>
                @foreach($occupants as $occupant)
                    <td>{{ $occupant['name'] }}</td>
                @endforeach
            </tr>
            <tr>
            <td>Accommodation Identity / 住宿人身分</td>
                @foreach($occupants as $occupant)
                    <td>{{ $occupant['location'] }}</td>
                @endforeach
            </tr>
            <tr>
            <td>Gender / 性別</td>
            @foreach($occupants as $occupant)
                <td>{{ $occupant['gender'] }}</td>
            @endforeach
        </tr>
            <tr>
                <td>Nationality / 國籍</td>
                @foreach($occupants as $occupant)
                    <td>{{ $occupant['nation'] }}</td>
                @endforeach
            </tr>
            <tr>
                <td>Start date / 開始時間</td>
                @foreach($occupants as $occupant)
                    <td>{{ $occupant['start_date'] }}</td>
                @endforeach
            </tr>
            <tr>
                <td>End date / 結束時間</td>
                @foreach($occupants as $occupant)
                    <td>{{ $occupant['end_date'] }}</td>
                @endforeach
            </tr>
            <tr>
                <td>Note / 備註</td>
                @foreach($occupants as $occupant)
                    <td>{{ $occupant['note'] ?? '-' }}</td>
                @endforeach
            </tr>
            <tr>
                <td>Room / 房號</td>
                @foreach($occupants as $occupant)
                    <td>{{ $occupant['room_no'] ?? '-' }}</td>
                @endforeach
            </tr>
           
        </table>
    </div>
    @endif
    
    <p>Vui lòng kiểm tra trạng thái đơn tại/請在以下連結檢查申請狀態: <a href="{{ $link }}">{{ $link }}</a></p>
    
    <!-- <div class="qr-code">
        <p>QR Code của bạn/您的QR碼:</p>
        <img src="{{ $qrCodeUrl }}" alt="QR Code">
        <p class="qr-caption">Hãy lưu QR code này để sử dụng/請保存此QR碼以供使用</p>
    </div> -->
    
    <div style="margin-top: 30px; border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9;">
        <h3 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">VG出差住房須知 / NHỮNG ĐIỀU CẦN BIẾT Ở KÝ TÚC XÁ KHI CÔNG TÁC TẠI VG</h3>
        <ol style="padding-left: 20px;">
            <li>出入廠區務必攜帶發放的橘色住宿識別證，非對口單位工作區域請勿在廠區裡隨便走動<br>
            Khi ra vào khu vực nhà máy yêu cầu phải đeo thẻ ký túc xá màu cam để nhận biết, không được tùy tiện đi lại những khu vực của bộ phận khác không liên quan đến công việc</li>
            <li>用餐時間:早餐6:00-7:30/午餐:10:50-12:15(依對口單位用餐時間為主)/晚餐17:00-18:00<br>
            Thời gian dùng cơm: Buổi sáng 06:00-07:30/ Buổi trưa :10:50-12:15 (phụ thuộc theo thời gian dùng cơm của bộ phận hiện tại đến công tác)/ Buổi tối : 17:00-18:00</li>
            <li>WIFI帳號/密碼:統一放在桌上<br>
            Tài khoản /mật khẩu WIFI: được bố trí trên bàn phòng khách</li>
            <li>星期一~星期六提供洗衣服務，可將要洗衣服擺在門外洗衣籃裡，下班後各棟晒衣場找尋自己衣服<br>
            Quần áo sẽ nhận giặc từ thứ hai đến thứ bảy, quần áo cần giặc vui lòng bỏ vào giỏ và đặt trước cửa phòng, sau giờ tan ca vui lòng đến khu vực phơi quần áo của từng khu ở để lấy quần áo của mình đem về.</li>
            <li>不提供貼身內衣、襪子、非衣服外的任何物品(娃娃.包包.鞋子……)<br>
            Không phụ trách giặc đồ lót, vớ, những vật dụng ngoài quần áo ra (gấu bông, ba lô túi xách, giày…)</li>
            <li>如自行洗衣者於面向足球場陽台禁止曬衣物<br>
            Nếu người công tác tự giặc quần áo , vui lòng không được phơi quần áo đối diện hướng sân vận động.</li>
            <li>阿姨只掃公共區域(客廳.共用廁所……)<br>
            Nhân viên vệ sinh chỉ phụ trách quét dọn khu vực công cộng( phòng khách, toilet dùng chung,…)</li>
            <li>貴重物品請自行保管好<br>
            Những vật dụng có giá trị vui lòng tự bảo quản</li>
            <li>入住期間各項休閒設施均可使用，離開時將請關閉照明和風扇<br>
            Trong thời gian ở ký túc xá những thiết bị giải trí có thể sử dụng, khi rời khỏi vui lòng tắt đèn tắt quạt</li>
            <li>房內之電器、裝置、家具用品，如因使用不當而造成汙損或毀壞按規定賠償<br>
            Những thiết bị điện , bài trí, ,vật dụng trong phòng, nếu sử dụng không đúng cách dẫn đến hư hại hoặc hủy hoại sẽ căn cứ theo quy định công ty yêu cầu bồi thường.</li>
            <li>入住者應注意個人行為禁止大聲喧嘩，不得影響他人休息<br>
            Khi vào ở ký túc xá phải chú ý việc đi lại không được nói chuyện lớn tiếng ồn ào, ảnh hưởng đến người khác nghĩ ngơi.</li>
            <li>入住期間請節約用水用電隨手關<br>
            Trong thời gian ở ký túc xá vui lòng tiết kiệm điện, nước,sử dụng xong vui lòng tắt điện tắt nước.</li>
            <li>退房時將鑰匙插於門上後,並將住宿識別證歸還宿舍保衛<br>
            Khi trả phòng vui lòng gắn chìa khóa trên cửa phòng,đồng thời thẻ đeo ký túc xá trả lại cho bảo vệ ký túc xá.</li>
            <li>如有任何住宿問題請對口單位協助轉達總務處理<br>
            Nếu như có bất kỳ vấn đề về ký túc xá vui lòng báo cho bộ phận đến công tác để hỗ trợ chuyển vấn đề cho tổng vụ giải quyết</li>
        </ol>
    </div>
</body>
</html>
