<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\vgDormMdl as drom_dataMdl;
use App\vgDormLocMdl as dormLocMdl;
use App\vgDormNationMdl as dormNationMdl;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Facades\Image;
use Symfony\Component\HttpFoundation\Response;

class vgDormCtrl extends Controller 
{
    // Constants
    const STATUS_TEMPLATES = [
        'DEPT' => ['dept' => 'true', 'stt' => 'accept'],
        'GA' => ['ga' => 'true', 'stt' => 'accept'], 
        'SMP' => ['smp' => 'true', 'stt' => 'accept'],
        'GM' => ['gm' => 'true', 'stt' => 'accept']
    ];

    // Helper Functions 
    private function updateModel($id, $data) {
        try {
            drom_dataMdl::where('id', $id)->update($data);
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false, 
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function getLevelInfo($empno, $dataAppFlow) {
        $levels = ['DEPT' => 0, 'GA' => 1, 'SMP' => 2, 'GM' => 3];
        foreach ($levels as $level => $index) {
            if ($this->isLevelManager($empno, $dataAppFlow, $index)) {
                return ['level' => $level, 'index' => $index];
            }
        }
        return null;
    }

    private function isLevelManager($empno, $dataAppFlow, $level) {
        return collect($dataAppFlow[$level]['managers'])->contains('empno', $empno);
    }

    // Main API Methods
    public function confirmAccept(Request $req) {
        try {
            $item = $req->item;
            $currentUser = $req->currentUser;
            $dataAppFlow = json_decode($req->dataAppFlow, true);
            
            $levelInfo = $this->getLevelInfo($currentUser['empno'], $dataAppFlow);
            if (!$levelInfo) throw new \Exception('Invalid user level');

            $status = json_decode($item['status'], true);
            $approval = json_decode($item['approval'], true);
            
            // Update status for current level
            $status[$levelInfo['index']] = self::STATUS_TEMPLATES[$levelInfo['level']];
            
            // Setup next level if not GM
            if ($levelInfo['level'] != 'GM') {
                $nextIndex = $levelInfo['index'] + 1;
                $status[$nextIndex] = [
                    key(self::STATUS_TEMPLATES[array_keys(self::STATUS_TEMPLATES)[$nextIndex]]) => 'false',
                    'stt' => 'waiting ' . strtolower(array_keys(self::STATUS_TEMPLATES)[$nextIndex])
                ];
            }

            // Update approval
            $approval[$levelInfo['index']] = [
                'empno' => $currentUser['empno'],
                'name' => $currentUser['name'],
                'email' => $currentUser['email'],
                'date' => now(),
                'stt' => 'accept',
                'reason' => ''
            ];

            // Send notifications
            if ($levelInfo['level'] != 'GM') {
                $nextManagers = collect($dataAppFlow[$nextIndex]['managers'])->pluck('email');
                $this->sendNotification(
                    'VG-EXPAT-PS-TESTING',
                    $this->buildEmailMessage($item, $currentUser, $levelInfo['level']),
                    $nextManagers->toArray()
                );
            } else {
                $submitter = json_decode($item['submitter'], true);
                $this->sendNotification(
                    'VG-EXPAT-PS-TESTING', 
                    $this->buildSubmitterMessage($submitter),
                    [$submitter['email']]
                );
            }

            return $this->updateModel($item['id'], [
                'status' => json_encode($status),
                'approval' => json_encode($approval)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage() 
            ], 500);
        }
    }

    public function savedb(Request $req)
    {
        try {
            // Validate required fields
            $req->validate([
                'key_in_date' => 'required|date',
                'approval' => 'required|json',
                'status' => 'required|json',
                'submitter' => 'required|json',
                'contacts' => 'required|json'
            ]);

            // Decode contacts JSON
            $contacts = json_decode($req->contacts, true);

            // Create main record with first contact's data
            $mainContact = $contacts[0];

            return drom_dataMdl::updateOrCreate([
                'id' => $req->id
            ], [
                'key_in_date' => $req->key_in_date,
                'approval' => $req->approval,
                'status' => $req->status,
                'submitter' => $req->submitter,
                'name' => json_encode($contacts), 
                'reason' => $req->reason,  
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }
    // get data from database dorm_dataMdl
    public function getAllData()
    {
        return ['dormData' => drom_dataMdl::orderBy('id', 'desc')->get()];
    }
    public function acceptRequest(Request $req)
    {
        try {
            $result = drom_dataMdl::where('id', $req->id)
            ->update([
                'status' => $req->status,
                'approval' => $req->approval
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Request accepted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to accept request',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    public function denyRequest(Request $req)
    {
        try {
            $result = drom_dataMdl::where('id', $req->id)
            ->update([
                'status' => $req->status,
                'approval' => $req->approval
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Request denied successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to deny request',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    // get data from database dormLocMdl
    public function getDormLoc()
    {
        return ['dormLoc' => dormLocMdl::orderBy('id', 'asc')->get()];
    }
    // dormNationMdl
    public function getDormNation()
    {
        return ['dormNation' => dormNationMdl::orderBy('id', 'asc')->get()];
    }
    // updateRoom
    public function updateRoom(Request $req)
    {
        try {
            $result = drom_dataMdl::where('id', $req->id)
            ->update([
                'room_no' => $req->room_no
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Room updated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update room',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    // updateQRCode
    public function updateQRCode(Request $req)
    {
        $req->validate([
            'id' => 'required', // Chấp nhận cả chuỗi và số
            'qr_code' => 'required|string',
        ]);
        
        $qrCodeData = $req->input('qr_code');
        
        if (preg_match('/^data:image\/(?<type>.+);base64,(?<data>.+)$/', $qrCodeData, $matches)) {
            $imageData = base64_decode($matches['data']);
            $fileName = 'dma/' . Str::random(10) . '.png';
            Storage::put($fileName, $imageData);
            
            // Cập nhật vào cơ sở dữ liệu
            $dormData = drom_dataMdl::find($req->input('id'));
            
            if ($dormData) {
                $dormData->qr_code = $fileName; // Giả sử bạn có trường này trong bảng
                $dormData->save();
            } else {
                return response()->json(['message' => 'Record not found'], 404);
            }
            
            return response()->json(['message' => 'QR code saved successfully', 'file_name' => $fileName], 200);
        }
        
        return response()->json(['message' => 'Invalid QR code data'], 400);
    }
    public function getQRCode($appname = null,$id=null)
    {
        if ($id) {
            $data = drom_dataMdl::find($id);
    
            if (!$data) {
                return response()->json(['error' => 'Record not found'], 404);
            }
    
            $photoPath = $data->qr_code; 
            $fullPath = storage_path('app/' . $photoPath);
    
            if (!file_exists($fullPath)) {
                return response()->json(['error' => 'Image file does not exist at path: ' . $fullPath], 404);
            }
    
            return Image::make($fullPath)->widen(300)->response('png');
        } else {
            $img = Image::canvas(300, 400, '#ff0000');
            $img->text('TOKEN INVALID', 35, 175, function ($font) {
                $font->file(realpath('arial.ttf'));
                $font->size(15);
                $font->color([255, 255, 0, 1]);
                $font->align('left');
                $font->valign('top');
            });
            return $img->response('png', 90);
        }
    }
    
    private function buildEmailMessage($item, $currentUser, $level, $link) {
        $nameArray = json_decode($item['name'], true);
        
        $tableRows = collect($nameArray)->map(function($person) {
            return [
                'name' => $person['name'],
                'nation' => $this->getLocalizedNation($person['nation']),
                'location' => $person['location'],
                'gender' => $person['gender'] === 'M' ? 'Male/男' : 'Female/女',
                'start_date' => $person['start_date'],
                'end_date' => $person['end_date'],
                'note' => $person['note'] ?? '-',
                'reason' => $person['reason'] ?? '-'
            ];
        })->toArray();

        return view('emails.approval-notification', [
            'dept' => $currentUser['dept'],
            'count' => count($nameArray),
            'rows' => $tableRows,
            'level' => $level,
            'link' => $link
        ])->render();
    }

    private function buildSubmitterMessage($submitter, $link) {
        return view('emails.request-completed', [
            'name' => $submitter['name'],
            'dept' => $submitter['dept'],
            'link' => $link
        ])->render();
    }

    private function sendNotification($target, $body, $recipients) {
        $mailData = [
            'to' => $recipients,
            'subject' => "Dormitory Application",
            'msgBody' => $body,
        ];

        $params = [
            'target' => $target,
            'body' => $body,
            'msg_type' => "m",
            'msg_method' => "both", 
            'msg_subject' => "Dormitory Application",
            'mail_template' => "msgCenterMailTemplate",
            'mail_data' => json_encode($mailData),
        ];

        return $this->sendMsg($params);
    }

    private function getLocalizedNation($nationId) {
        try {
            if (!$nationId) return '';
            
            $nationItem = dormNationMdl::find($nationId);
            if (!$nationItem) return "Nation ID: {$nationId}";
            
            $nationObj = json_decode($nationItem->nation, true);
            if (!$nationObj) return '';
            
            // Default to English if no locale matches
            return $nationObj['en'] ?? '';
            
        } catch (\Exception $e) {
            \Log::error('Error in getLocalizedNation: ' . $e->getMessage());
            return "Error: {$nationId}";
        }
    }
}

