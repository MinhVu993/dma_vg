<table>
    <tr>
        <th>STT</th>
        <th>Họ và tên</th>
        <th>Ngày sinh</th>
        <th>QT</th>
        <th>Số HC</th>
        <th>Ngày đến</th>
        <th>Ngày đi DK</th>
        <th>Ngày trả phòng</th>
    </tr>
    @foreach($occupants as $index => $occupant)
    <tr>
        <td>{{ $index + 1 }}</td>
        <td>{{ $occupant['name'] }}</td>
        <td>{{ $occupant['birth_date'] ?? '' }}</td>
        <td>{{ $occupant['nation'] }}</td>
        <td>{{ $occupant['id_number'] ?? '' }}</td>
        <td>{{ $occupant['start_date'] }}</td>
        <td>{{ $occupant['end_date'] }}</td>
        <td>{{ $occupant['end_date'] }}</td>
    </tr>
    @endforeach
</table>
