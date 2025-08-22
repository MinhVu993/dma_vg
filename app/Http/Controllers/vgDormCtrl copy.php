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
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class vgDormCtrl extends Controller 
{
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
        if (!$empno || !$dataAppFlow || !is_array($dataAppFlow)) {
            return null;
        }
        
        foreach ($dataAppFlow as $index => $level) {
            if (isset($level['managers']) && is_array($level['managers'])) {
                foreach ($level['managers'] as $manager) {
                    if (strtoupper($manager['empno']) === strtoupper($empno)) {
                        $levelKey = sprintf('%s-%s-%s',
                        $manager['empno'],
                        $manager['name'],
                        implode(',', $manager['dept_code'])
                    );
                    
                    // Get current level managers' empnos (for case-insensitive comparison)
                    $currentLevelManagerEmpnos = array_map(function($m) {
                        return strtoupper($m['empno']);
                    }, $level['managers']);
                    
                    // Find the next valid level (that doesn't have any common managers)
                    $nextValidIndex = null;
                    
                    for ($i = $index + 1; $i < count($dataAppFlow); $i++) {
                        $nextLevel = $dataAppFlow[$i];
                        
                        $hasCommonManager = false;
                        if (isset($nextLevel['managers']) && is_array($nextLevel['managers'])) {
                            foreach ($nextLevel['managers'] as $nextManager) {
                                if (in_array(strtoupper($nextManager['empno']), $currentLevelManagerEmpnos)) {
                                    $hasCommonManager = true;
                                    break;
                                }
                            }
                        }
                        
                        if (!$hasCommonManager) {
                            $nextValidIndex = $i;
                            break;
                        }
                    }
                    
                    return [
                        'level' => $levelKey, 
                        'index' => $index,
                        'info' => $levelKey,
                        'nextValidIndex' => $nextValidIndex
                    ];
                }
            }
        }
    }
    return null;
}

private function isLevelManager($empno, $dataAppFlow, $level) {
    return isset($dataAppFlow[$level]['managers']) && 
    collect($dataAppFlow[$level]['managers'])->contains('empno', $empno);
}

private function getStatusTemplates($dataAppFlow) {
    $templates = [];
    foreach ($dataAppFlow as $index => $level) {
        if (isset($level['managers'][0])) {
            $manager = $level['managers'][0];
            $key = sprintf('%s-%s-%s', 
            $manager['empno'],
            $manager['name'],
            implode(',', $manager['dept_code'])
        );
        $templates[$key] = [
            strtolower($key) => 'true',
            'stt' => 'accept'
        ];
    }
}
return $templates;
}
public function savedb(Request $req)
{
    try {
        $req->validate([
            'key_in_date' => 'required|date',
            'approval' => 'required|json',
            'status' => 'required|json',
            'submitter' => 'required|json',
            'contacts' => 'required|json'
        ]);
        
        $contacts = json_decode($req->contacts, true);
        
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
public function getAllData()
{
    return ['dormData' => drom_dataMdl::orderBy('id', 'desc')->get()];
}
public function acceptRequest(Request $req)
{
    try {
        $status = $req->status;
        $approval = $req->approval;
        
        if (is_array($status)) {
            $status = json_encode($status);
        } elseif (!is_string($status)) {
            throw new \Exception('Invalid status format: ' . gettype($status));
        }
        
        if (is_array($approval)) {
            $approval = json_encode($approval);
        } elseif (!is_string($approval)) {
            throw new \Exception('Invalid approval format: ' . gettype($approval));
        }
        $result = drom_dataMdl::where('id', $req->id)
        ->update([
            'status' => $status,
            'approval' => $approval
        ]);
        
        $item = drom_dataMdl::find($req->id);
        if (!$item) {
            throw new \Exception('Record not found after update');
        }
        
        $dataAppFlow = $this->safeJsonDecode($req->dataAppFlow);
        $currentUser = $req->currentUser;
        if (is_string($currentUser)) {
            $currentUser = json_decode($currentUser, true);
        }
        if (!is_array($currentUser)) {
            throw new \Exception('Invalid currentUser format: ' . gettype($currentUser));
        }
        $levelInfo = $this->getLevelInfo($currentUser['empno'], $dataAppFlow);
        if (!$levelInfo) {
            throw new \Exception('Invalid user level');
        }
        $isLastLevel = $levelInfo['index'] >= count($dataAppFlow) - 1;
        
        
        $nextIndex = isset($levelInfo['nextValidIndex']) ? $levelInfo['nextValidIndex'] : $levelInfo['index'] + 1;
        
        $debugInfo = [
            'current_level' => [
                'index' => $levelInfo['index'],
                'level' => $levelInfo['level'],
                'name' => $this->getDenierLevel($levelInfo['index'])
            ],
            'next_level' => $isLastLevel ? 'None (Final Level)' : [
                'index' => $nextIndex,
                'name' => $this->getDenierLevel($nextIndex)
            ],
            'is_last_level' => $isLastLevel
        ];
        
        $submitter = json_decode($item->submitter, true);
        $nameArray = json_decode($item->name, true);
        
        $occupants = $this->formatOccupantsData($nameArray);
        
        $emailData = [
            'department' => $submitter['dept'] ?? '',
            'occupants' => $occupants,
            'count' => count($occupants),
            'link' => "http://gmo021.cansportsvg.com/ga/dma"
        ];
        
        if (!$isLastLevel && isset($dataAppFlow[$nextIndex]) && isset($dataAppFlow[$nextIndex]['managers'])) {
            $nextManagers = collect($dataAppFlow[$nextIndex]['managers'])->pluck('email');
            $emailContent = view('VgDorm-approval', $emailData)->render();
            
            try {
                $this->sendNotification(
                    'VG-EXPAT-PS-TESTING',
                    $emailContent,
                    $nextManagers->toArray()
                );
            } catch (\Exception $e) {
            }
        } else {
            $emailContent = $this->buildSubmitterMessage($submitter, $item);
            
            try {
                $this->sendNotification(
                    'VG-EXPAT-PS-TESTING',
                    $emailContent,
                    [$submitter['email']]
                );
            } catch (\Exception $e) {
            }
        }
        return response()->json([
            'success' => true,
            'message' => 'Request accepted successfully',
            'debug' => $debugInfo  // Include debug info in the response
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
        if (!$req->id) {
            throw new \Exception('Missing request ID');
        }
        
        $item = drom_dataMdl::findOrFail($req->id);
        
        $status = is_string($req->status) ? $req->status : json_encode($req->status);
        if (!$status) {
            throw new \Exception('Invalid status data');
        }
        
        $approval = is_string($req->approval) ? $req->approval : json_encode($req->approval);
        if (!$approval) {
            throw new \Exception('Invalid approval data');
        }
        
        $result = $item->update([
            'status' => $status,
            'approval' => $approval
        ]);
        
        if (!$result) {
            throw new \Exception('Failed to update database record');
        }
        
        $submitter = json_decode($item->submitter, true);
        $nameArray = json_decode($item->name, true);
        $approvalArray = json_decode($approval, true);
        
        
        if (!is_array($approvalArray)) {
            throw new \Exception('Invalid approval array format');
        }
        
        $lastApproval = collect($approvalArray)
        ->filter(function($a) {
            return !empty($a['reason']) && $a['stt'] === 'deny';
        })
        ->last(); 
        
        if (!$lastApproval) {
            throw new \Exception('No valid denial information found');
        }
        
        $emailData = [
            'submitter_name' => $submitter['name'] ?? '',
            'denier_level' => $this->getDenierLevel(array_search($lastApproval, $approvalArray)),
            'department' => $submitter['dept'] ?? '',
            'deny_reason' => $lastApproval['reason'] ?? '',
            'link' => "http://gmo021.cansportsvg.com/ga/dma",
            'occupants' => $this->formatOccupantsData($nameArray)
        ];
        if (isset($submitter['email'])) {
            $emailContent = view('vgDorm-request-denied', $emailData)->render();
            $this->sendNotification(
                'VG-EXPAT-PS-TESTING',
                $emailContent,
                [$submitter['email']]
            );
        }
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
private function formatOccupantsData($nameArray)
{
    try {
        if (!is_array($nameArray)) {
            return ['abc'];
        }
        return collect($nameArray)->map(function($person) {
            if (!is_array($person)) {
                return $this->getDefaultOccupantData();
            }
            $location = '';
            if (isset($person['location'])) {
                if (is_array($person['location'])) {
                    $location = $person['location']['loc'] ?? '';
                } else {
                    $location = (string)$person['location'];
                }
            }
            
            $gender = '';
            if (isset($person['gender'])) {
                $gender = strtoupper($person['gender']) === 'F' ? 'Female/女' : 'Male/男';
            }
            return [
                'name' => (string)($person['name'] ?? ''),
                'nation' => $this->getLocalizedNation($person['nation'] ?? ''),
                'location' => $location,
                'gender' => $gender,
                'start_date' => (string)($person['start_date'] ?? ''),
                'end_date' => (string)($person['end_date'] ?? ''),
                'note' => (string)($person['note'] ?? ''),
                'room_no' => (string)($person['room_no'] ?? '')
                
            ];
        })->all();
        
    } catch (\Exception $e) {
        
        return ['abc'];
    }
}

private function getDenierLevel($index) {
    $levels = [
        0 => 'Department Level/部門',
        1 => 'GA Level/總務部',
        2 => 'SMP Level/處長級',
        3 => 'GM Level/總經理'
    ];
    return $levels[$index] ?? 'Unknown Level';
}
private function getDefaultOccupantData()
{
    return [
        'name' => '',
        'nation' => '',
        'location' => '',
        'gender' => '',
        'start_date' => '',
        'end_date' => '',
        'note' => '',
        'room_no'=> ''
    ];
}

public function getDormLoc()
{
    return ['dormLoc' => dormLocMdl::orderBy('id', 'asc')->get()];
}
public function getDormNation()
{
    return ['dormNation' => dormNationMdl::orderBy('id', 'asc')->get()];
}
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
public function updateQRCode(Request $req)
{
    try {
        $req->validate([
            'id' => 'required',
            'qr_code' => 'required|array'
        ]);
        
        $qrArray = [];
        foreach ($req->qr_code as $person) {
            if (preg_match('/^data:image\/(?<type>.+);base64,(?<data>.+)$/', $person['qr'], $matches)) {
                $imageData = base64_decode($matches['data']);
                $fileName = 'dma/' . $req->id . '_' . Str::slug($person['name']) . '_' . Str::random(5) . '.png';
                Storage::put($fileName, $imageData);
                
                $qrArray[] = [
                    'name' => $person['name'],
                    'qr' => $fileName
                ];
            }
        }
        
        $dormData = drom_dataMdl::find($req->id);
        if (!$dormData) {
            return response()->json(['message' => 'Record not found'], 404);
        }
        
        $dormData->qr_code = json_encode($qrArray);
        $dormData->save();
        
        return response()->json([
            'success' => true,
            'message' => 'QR codes saved successfully'
        ], 200);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false, 
            'message' => $e->getMessage()
        ], 500);
    }
}

public function getQRCode($appname = null, $id = null, $name = null) 
{
    try {
        if (strpos($id, '_') !== false) {
            $filename = 'dma/' . $id;
            $path = storage_path('app/' . $filename);
            
            if (!file_exists($path)) {
                
                return response()->json(['error' => 'QR code file not found'], 404);
            }
            
            return response()->file($path, [
                'Content-Type' => 'image/png',
                'Content-Disposition' => 'inline',
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }
        
        if (!$id) {
            return response()->json(['error' => 'ID is required'], 400);
        }
        
        $data = drom_dataMdl::find($id);
        if (!$data || !$data->qr_code) {
            return response()->json(['error' => 'QR code data not found'], 404);
        }
        
        $qrCodes = json_decode($data->qr_code, true);
        if (!is_array($qrCodes)) {
            return response()->json(['error' => 'Invalid QR code data'], 400);
        }
        
        $qrInfo = null;
        if ($name) {
            foreach ($qrCodes as $qr) {
                if ($qr['name'] === $name) {
                    $qrInfo = $qr;
                    break;
                }
            }
        } else {
            $qrInfo = $qrCodes[0] ?? null;
        }
        
        if (!$qrInfo || !isset($qrInfo['qr'])) {
            return response()->json(['error' => 'QR code not found'], 404);
        }
        
        $path = storage_path('app/' . $qrInfo['qr']);
        if (!file_exists($path)) {
            
            return response()->json(['error' => 'QR code file not found'], 404);
        }
        
        return response()->file($path, [
            'Content-Type' => 'image/png',
            'Content-Disposition' => 'inline',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
        
    } catch (\Exception $e) {
        
        return response()->json(['error' => 'Failed to retrieve QR code'], 500);
    }
}

private function buildEmailMessage($item, $currentUser, $level) {
    try {
        $itemArray = is_object($item) ? $item->toArray() : $item;
        
        $nameData = [];
        if (isset($itemArray['name'])) {
            if (is_array($itemArray['name'])) {
                $nameData = $itemArray['name'];
            } 
            else if (is_string($itemArray['name'])) {
                $decoded = json_decode($itemArray['name'], true);
                if (is_array($decoded)) {
                    $nameData = $decoded;
                } else {
                    $nameData = [];
                }
            }
        }
        
        if (!is_array($nameData)) {
            $nameData = [];
        }
        
        $rows = collect($nameData)->map(function($person) {
            if (!is_array($person)) {
                return [
                    'name' => '',
                    'nation' => '',
                    'location' => '',
                    'gender' => 'Male/男',
                    'start_date' => '',
                    'end_date' => '',
                    'note' => '-'
                ];
            }
            
            return [
                'name' => strval($person['name'] ?? ''),
                'nation' => strval($this->getLocalizedNation($person['nation'] ?? '')),
                'location' => strval($person['location'] ?? ''),
                'gender' => (isset($person['gender']) && $person['gender'] === 'F') ? 'Female/女' : 'Male/男',
                'start_date' => strval($person['start_date'] ?? ''),
                'end_date' => strval($person['end_date'] ?? ''),
                'note' => strval($person['note'] ?? '-')
            ];
        })->toArray();
        
        $dept = '';
        if (isset($currentUser['dept'])) {
            $dept = is_string($currentUser['dept']) ? $currentUser['dept'] : '';
        }
        
        $viewData = [
            'dept' => $dept,
            'count' => count($nameData),
            'rows' => $rows,
            'level' => strval($level),
            'link' => "http://gmo021.cansportsvg.com/ga/dma"
        ];
        
        return view('VgDorm-approval', $viewData)->render();
        
    } catch (\Exception $e) {
        throw $e;
    }
}

private function buildSubmitterMessage($submitter, $item) {
    try {
        $link = "http://gmo021.cansportsvg.com/ga/dma";
        $qrCodeUrl = "http://gmo021.cansportsvg.com/api/vgDorm/getQRCode/dma/" . $item->id;
        
        $nameArray = json_decode($item->name, true);
        $occupants = $this->formatOccupantsData($nameArray);
        
        $msgCtrl = new msgCenterCtrl();
        
        $bccMsgId = new Request();
        $bccMsgId->merge(['msgId' => 'VG-DMA-HR']);
        $bccMails = $msgCtrl->getEmailByMsgId($bccMsgId);
        
        if ($bccMails == 'wrong msg_id' || !is_array($bccMails)) {
            $bccMails = [];
        }
        
        $mailData = [
            'subject' => '[DMA] Dormitory Application',
            'to' => [$submitter['email']],
            'bcc' => $bccMails,
            'name' => $submitter['name'],
            'dept' => $submitter['dept'],
            'link' => $link,
            'qrCodeUrl' => $qrCodeUrl,
            'occupants' => $occupants
        ];
        
        $mailRecord = new Request();
        $mailRecord->merge([
            'target' => 'VG-DMA-HR',
            'msg_type' => 'm',
            'msg_method' => 'email',
            'mail_template' => 'vgDormrequest-completed',
            'msg_subject' => '[DMA] Dormitory Application',
            'mail_data' => json_encode($mailData),
        ]);
        
        $result = $msgCtrl->sendOutMsg($mailRecord);
        
        return view('vgDormrequest-completed', [
            'name' => $submitter['name'],
            'dept' => $submitter['dept'],
            'link' => $link,
            'qrCodeUrl' => $qrCodeUrl,
            'occupants' => $occupants
            ])->render();
            
        } catch (\Exception $e) {
            return view('vgDormrequest-completed', [
                'name' => $submitter['name'] ?? '',
                'dept' => $submitter['dept'] ?? '',
                'link' => "http://gmo021.cansportsvg.com/ga/dma",
                'qrCodeUrl' => "http://gmo021.cansportsvg.com/api/vgDorm/getQRCode/dma/" . $item->id,
                'occupants' => $this->formatOccupantsData(json_decode($item->name ?? '[]', true))
                ])->render();
            }
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
                
                return $nationObj['en'] ?? '';
                
            } catch (\Exception $e) {
                return "Error: {$nationId}";
            }
        }
        
        private function sendMsg($params) 
        {
            try {
                $client = new \GuzzleHttp\Client();
                
                $formData = http_build_query($params);
                
                $response = $client->post("http://gmo021.cansportsvg.com/api/msg-center/sendOutMsg", [
                    'headers' => [
                        'Content-Type' => 'application/x-www-form-urlencoded'
                    ],
                    'body' => $formData 
                ]);
                
                return json_decode($response->getBody()->getContents(), true);
            } catch (\Exception $e) {
                throw $e;
            }
        }
        public function getFilteredRequests($userData, $includeDeputy = true) 
        {
            try {
                if (!isset($userData['empno']) || !isset($userData['dataAppFlow'])) {
                    return collect([]); 
                }
                
                $empno = $userData['empno'];
                $dataAppFlow = json_decode($userData['dataAppFlow'], true);
                
                if (!$dataAppFlow) {
                    return collect([]); 
                }
                
                $levelInfo = $this->getLevelInfo($empno, $dataAppFlow);
                if (!$levelInfo) {
                    return collect([]); 
                }
                
                $isManager = $this->isLevelManager($empno, $dataAppFlow, $levelInfo['index']);
                
                $requests = drom_dataMdl::where('status', 'like', '%accept%')
                ->where('status', 'not like', '%waiting%')
                ->where('status', 'not like', '%deny%')
                ->get();
                
                if ($isManager && $includeDeputy) {
                    $deputyRequests = drom_dataMdl::where('status', 'like', '%waiting%')
                    ->where('status', 'not like', '%deny%')
                    ->get();
                    
                    $requests = $requests->merge($deputyRequests);
                }
                
                return $requests;
                
            } catch (\Exception $e) {
                return collect([]); 
            }
        }
        public function getProcessedRequestsByEmpno(Request $req)
        {
            try {
                $userData = $req->userData;
                $empno = $userData['empno'];
                $dataAppFlow = json_decode($userData['dataAppFlow'], true);
                $levelInfo = self::getLevelInfo($empno, $dataAppFlow);
                $isManager = self::isLevelManager($empno, $dataAppFlow, $levelInfo['index']);
                
                $requests = drom_dataMdl::where('status', 'like', '%accept%')
                ->where('status', 'not like', '%waiting%')
                ->where('status', 'not like', '%deny%')
                ->get();
                
                if ($isManager) {
                    $deputyRequests = drom_dataMdl::where('status', 'like', '%waiting%')
                    ->where('status', 'not like', '%deny%')
                    ->get();
                    
                    $requests = $requests->merge($deputyRequests);
                }
                return response()->json([
                    'success' => true,
                    'data' => $requests
                ]);
            } catch (\Exception $e) {
                return response()->json([
                    'success' => false,
                    'error' => $e->getMessage()
                ], 500);
            }
        }
        private function safeJsonDecode($data) 
        {
            if (is_array($data)) {
                return $data;
            }
            
            if (is_string($data)) {
                $decoded = json_decode($data, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return $decoded;
                }
            }
            
            return [];
        }
        
        private function generateQRContent($item) {
            try {
                $submitter = json_decode($item->submitter, true);
                $nameArray = json_decode($item->name, true);
                
                $qrContent = implode(';', [
                    $item->id,
                    $submitter['empno'],
                    $submitter['dept'], 
                    $item->key_in_date
                ]);
                
                foreach ($nameArray as $occupant) {
                    $location = '';
                    if (is_array($occupant['location']) && isset($occupant['location']['loc'])) {
                        $location = $occupant['location']['loc'];
                    } else if (is_string($occupant['location'])) {
                        $location = $occupant['location'];
                    }
                    
                    $qrContent .= ';' . implode(';', [
                        $occupant['name'],
                        $this->getLocalizedNation($occupant['nation']),
                        $location,
                        $occupant['start_date'],
                        $occupant['end_date']
                    ]);
                }
                
                return $qrContent;
                
            } catch (\Exception $e) {
                
                return null;
            }
        }
        
        public function updateRoomInName(Request $req)
        {
            try {
                $req->validate([
                    'id' => 'required',
                    'name' => 'required|json'
                ]);
                
                $dormData = drom_dataMdl::findOrFail($req->id);
                $dormData->name = $req->name;
                
                $nameArray = json_decode($req->name, true);
                
                $qrArray = [];
                
                if ($req->has('qr_codes') && is_array($req->qr_codes) && !empty($req->qr_codes)) {
                    foreach ($req->qr_codes as $person) {
                        if (!isset($person['name']) || !isset($person['qr'])) {
                            continue;
                        }
                        
                        if (preg_match('/^data:image\/(?<type>.+);base64,(?<data>.+)$/', $person['qr'], $matches)) {
                            $imageData = base64_decode($matches['data']);
                            $fileName = 'dma/' . $req->id . '_' . Str::slug($person['name']) . '_' . Str::random(5) . '.png';
                            
                            Storage::put($fileName, $imageData);
                            
                            $qrArray[] = [
                                'name' => $person['name'],
                                'qr' => $fileName
                            ];
                        }
                    }
                } 
                else {
                    foreach ($nameArray as $person) {
                        $fileName = 'dma/' . $req->id . '_' . Str::slug($person['name'] ?? 'unknown') . '_' . Str::random(5) . '.png';
                        
                        $qrArray[] = [
                            'name' => $person['name'] ?? 'Unknown',
                            'qr' => $fileName
                        ];
                    }
                    
                }
                
                $dormData->qr_code = json_encode($qrArray);
                $dormData->save();
                
                return response()->json([
                    'success' => true,
                    'message' => 'Room number updated successfully',
                    'qr_filenames' => $qrArray 
                ]);
                
            } catch (ValidationException $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $e->errors()
                ], 422);
                
            } catch (\Exception $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to update room and QR codes',
                    'error' => $e->getMessage()
                ], 500);
            }
        }
        public function sendNewRequestNotification(Request $request) 
        {
            try {
                $request->validate([
                    'target' => 'required|string',
                    'emailData' => 'required|array',
                    'managers' => 'required|array'
                ]);
                
                $target = $request->target;
                $emailData = $request->emailData;
                $managers = $request->managers;
                
                $templateData = [
                    'dept' => $emailData['dept'] ?? '',
                    'count' => $emailData['count'] ?? 0,
                    'rows' => $emailData['rows'] ?? [],
                    'link' => $emailData['link'] ?? 'http://gmo021.cansportsvg.com/ga/dma'
                ];
                
                $emailContent = view('vgDorm-new-request', $templateData)->render();
                
                $mailData = [
                    'to' => $managers,
                    'subject' => "New Dormitory Application / 新宿舍申請",
                    'msgBody' => $emailContent,
                ];
                
                $params = [
                    'target' => $target,
                    'body' => $emailContent,
                    'msg_type' => "m",
                    'msg_method' => "both",
                    'msg_subject' => "New Dormitory Application / 新宿舍申請",
                    'mail_template' => "msgCenterMailTemplate",
                    'mail_data' => json_encode($mailData),
                ];
                
                $response = $this->sendMsg($params);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Notification sent successfully'
                ]);
                
            } catch (\Exception $e) {
                return response()->json([
                    'success' => false,
                    'error' => $e->getMessage()
                ], 500);
            }
        }
    }
    
    