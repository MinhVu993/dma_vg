<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\awDormMdl as aw_drom_dataMdl;
use App\awDormLocMdl as aw_dormLocMdl;
use App\awDormNationMdl as aw_dormNationMdl;
use App\awDormNationMdl_sub as aw_dormNationMdl_sub;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Facades\Image;
use Symfony\Component\HttpFoundation\Response;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

use App\vfaFlowMdl;

class awDormCtrl extends Controller
{
    private function updateModel($id, $data)
    {
        try {
            aw_drom_dataMdl::where("id", $id)->update($data);
            return response()->json(["success" => true]);
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "error" => $e->getMessage(),
                ],
                500
            );
        }
    }
    private function getLevelInfo($empno, $dataAppFlow, $targetLevel = null)
    {
         if (!$empno || !$dataAppFlow || !is_array($dataAppFlow)) {
            return null;
        }

        $empnoList = [];
        if (is_array($empno)) {
            if (isset($empno['empno']) || isset($empno['group']) || isset($empno['group_empno']) || isset($empno['email']) || isset($empno['syno_user'])) {
                $empnoList = [
                    $empno['empno'] ?? null,
                    $empno['group'] ?? null,
                    $empno['group_empno'] ?? null,
                    $empno['syno_user'] ?? null,
                    $empno['username'] ?? null,
                    $empno['email'] ?? null,
                ];
            } else {
                $empnoList = $empno;
            }
        } else {
            $empnoList = [$empno];
        }

        $empnoList = array_map('strtoupper', array_values(array_unique(array_filter($empnoList))));

        if (empty($empnoList)) {
            return null;
        }

        $foundLevels = [];

        foreach ($dataAppFlow as $index => $level) {
            if (isset($level['managers']) && is_array($level['managers'])) {
                foreach ($level['managers'] as $manager) {
                    $deptStr = isset($manager['dept_names'])
                        ? (is_array($manager['dept_names']) ? implode(',', $manager['dept_names']) : $manager['dept_names'])
                        : (isset($manager['dept_code']) ? (is_array($manager['dept_code']) ? implode(',', $manager['dept_code']) : $manager['dept_code']) : '');

                    $mEmpno = strtoupper($manager['empno'] ?? '');
                    $mEmail = strtoupper($manager['email'] ?? '');
                    $mName  = strtoupper($manager['name'] ?? '');

                    $isMatch = (!empty($mEmpno) && in_array($mEmpno, $empnoList)) ||
                               (!empty($mEmail) && in_array($mEmail, $empnoList)) ||
                               (!empty($mName) && in_array($mName, $empnoList));

                    if ($isMatch) {
                        if (!isset($foundLevels[$index]) || $foundLevels[$index]['type'] !== 'direct') {
                            $foundLevels[$index] = [
                                'level' => sprintf(
                                    '%s-%s-%s',
                                    $manager['empno'] ?? '',
                                    $manager['name'] ?? '',
                                    $deptStr
                                ),
                                'index' => $index,
                                'type' => 'direct'
                            ];
                        }
                    }
                }
                foreach ($level['managers'] as $manager) {
                    $deptStr = isset($manager['dept_names'])
                        ? (is_array($manager['dept_names']) ? implode(',', $manager['dept_names']) : $manager['dept_names'])
                        : (isset($manager['dept_code']) ? (is_array($manager['dept_code']) ? implode(',', $manager['dept_code']) : $manager['dept_code']) : '');

                    if (isset($manager['deputies']) && is_array($manager['deputies'])) {
                        foreach ($manager['deputies'] as $deputy) {
                            $dStatus = $deputy['status'] ?? true;
                            if ($dStatus !== true && $dStatus !== 'true' && $dStatus !== 1 && $dStatus !== '1') {
                                continue;
                            }

                            $dEmpno = strtoupper($deputy['empno'] ?? '');
                            $dEmail = strtoupper($deputy['email'] ?? '');
                            $dName  = strtoupper($deputy['name'] ?? '');

                            $isDeputyMatch = (!empty($dEmpno) && in_array($dEmpno, $empnoList)) ||
                                             (!empty($dEmail) && in_array($dEmail, $empnoList)) ||
                                             (!empty($dName) && in_array($dName, $empnoList));

                            if ($isDeputyMatch) {
                                if (!isset($foundLevels[$index])) {
                                    $foundLevels[$index] = [
                                        'level' => sprintf(
                                            '%s-%s-%s',
                                            $deputy['empno'] ?? '',
                                            $deputy['name'] ?? $manager['name'] ?? '',
                                            $deptStr
                                        ),
                                        'index' => $index,
                                        'type' => 'deputy',
                                        'for_manager' => $manager['empno'] ?? ''
                                    ];
                                }
                            }
                        }
                    }
                }
            }
        }

        if ($targetLevel !== null) {
            $targetIndex = (int)$targetLevel;
            if (isset($foundLevels[$targetIndex])) {
                $levelInfo = $foundLevels[$targetIndex];
                $nextValidIndex = $this->calculateNextValidIndex($dataAppFlow, $targetIndex);
                $levelInfo['nextValidIndex'] = $nextValidIndex;
                return $levelInfo;
            }
            return null;
        }

        if (!empty($foundLevels)) {
            $lowestLevel = min(array_keys($foundLevels));
            $levelInfo = $foundLevels[$lowestLevel];
            $nextValidIndex = $this->calculateNextValidIndex($dataAppFlow, $lowestLevel);
            $levelInfo['nextValidIndex'] = $nextValidIndex;
            return $levelInfo;
        }

        return null;
    }

    private function calculateNextValidIndex($dataAppFlow, $currentIndex)
    {
        $currentLevelManagerEmpnos = array_map(function ($m) {
            return strtoupper($m["empno"]);
        }, $dataAppFlow[$currentIndex]["managers"]);

        for ($i = $currentIndex + 1; $i < count($dataAppFlow); $i++) {
            $nextLevel = $dataAppFlow[$i];
            $hasCommonManager = false;

            if (
                isset($nextLevel["managers"]) &&
                is_array($nextLevel["managers"])
            ) {
                foreach ($nextLevel["managers"] as $nextManager) {
                    if (
                        in_array(
                            strtoupper($nextManager["empno"]),
                            $currentLevelManagerEmpnos
                        )
                    ) {
                        $hasCommonManager = true;
                        break;
                    }
                }
            }

            if (!$hasCommonManager) {
                return $i;
            }
        }
        return null;
    }
    private function isLevelManager($empno, $dataAppFlow, $level)
    {
        return isset($dataAppFlow[$level]["managers"]) &&
            collect($dataAppFlow[$level]["managers"])->contains(
                "empno",
                $empno
            );
    }

    private function getStatusTemplates($dataAppFlow)
    {
        $templates = [];
        foreach ($dataAppFlow as $index => $level) {
            if (isset($level['managers'][0])) {
                $manager = $level['managers'][0];
                $deptStr = isset($manager['dept_names'])
                    ? (is_array($manager['dept_names']) ? implode(',', $manager['dept_names']) : $manager['dept_names'])
                    : (isset($manager['dept_code']) ? (is_array($manager['dept_code']) ? implode(',', $manager['dept_code']) : $manager['dept_code']) : '');

                $key = sprintf(
                    '%s-%s-%s',
                    $manager['empno'],
                    $manager['name'],
                    $deptStr
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
                "key_in_date" => "required|date",
                "approval" => "required|json",
                "status" => "required|json",
                "submitter" => "required|json",
                "contacts" => "required|json",
            ]);

            $contacts = json_decode($req->contacts, true);

            $mainContact = $contacts[0];

            return aw_drom_dataMdl::updateOrCreate(
                [
                    "id" => $req->id,
                ],
                [
                    "key_in_date" => $req->key_in_date,
                    "approval" => $req->approval,
                    "status" => $req->status,
                    "submitter" => $req->submitter,
                    "name" => json_encode($contacts),
                    "reason" => $req->reason,
                ]
            );
        } catch (\Exception $e) {
            return response()->json(
                [
                    "error" => $e->getMessage(),
                ],
                400
            );
        }
    }
    public function getAllData()
    {
        return ["dormData" => aw_drom_dataMdl::orderBy("id", "desc")->get()];
    }
    public function getApprovalFlow(Request $req)
    {
        try {
            $empno = $req->input("empno", null);
            $id = $req->input("id", null);
            $location = $req->input("location", "aw");
            if ($empno) {
                try {
                    $vfaController = new \App\Http\Controllers\vfaCtrl();
                    $vfaReq = new Request();
                    $vfaReq->merge([
                        "empno" => $empno,
                        "app_code" => "aw_dma_demo", // Theo yêu cầu
                        "location" => $location, // Giá trị nhận được hoặc 'aw'
                        "custom_data" => json_encode([]),
                    ]);
                    // -----------------------------

                    $flowResp = $vfaController->getFlowUpdated($vfaReq);
                    $approvalFlow = $flowResp->flow_data ?? [];

                    return response()->json(
                        ["success" => true, "flow" => $approvalFlow],
                        200
                    );
                } catch (\Exception $e) {
                    \Log::warning(
                        "getApprovalFlow: VFA lookup failed for empno " .
                            $empno .
                            " - " .
                            $e->getMessage()
                    );
                }
            }
            if (!$id) {
                return response()->json(
                    ["success" => false, "message" => "Missing empno or id"],
                    400
                );
            }
            $item = aw_drom_dataMdl::find($id);
            if (!$item) {
                return response()->json(
                    ["success" => false, "message" => "Record not found"],
                    404
                );
            }
            $flow = $item->flow_data ?? null;
            if (is_string($flow)) {
                $decoded = json_decode($flow, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $flow = $decoded;
                }
            }
            if (empty($flow) && $item->submitter) {
                $submitter = $item->submitter;
                if (is_string($submitter)) {
                    $submitter = json_decode($submitter, true);
                }
                $submitterEmpno = is_array($submitter)
                    ? $submitter["empno"] ?? null
                    : null;
                $submitterLocation = is_array($submitter)
                    ? $submitter["location"] ?? null
                    : null;

                if ($submitterEmpno) {
                    try {
                        $vfaController = new \App\Http\Controllers\vfaCtrl();
                        $vfaReq = new Request();
                        $vfaReq->merge([
                            "empno" => $submitterEmpno,
                            "app_code" => "aw_dma_demo",
                            "location" => $submitterLocation ?? "aw",
                            "custom_data" => json_encode([]),
                        ]);
                        $flowResp = $vfaController->getFlowUpdated($vfaReq);
                        $approvalFlow = $flowResp->flow_data ?? null;
                        if ($approvalFlow) {
                            $flow = $approvalFlow;
                        }
                    } catch (\Exception $e) {
                        \Log::warning(
                            "getApprovalFlow: Submitter VFA lookup failed: " .
                                $e->getMessage()
                        );
                    }
                }
            }
            $flow = $flow ?? [];
            return response()->json(["success" => true, "flow" => $flow], 200);
        } catch (\Exception $e) {
            return response()->json(
                ["success" => false, "message" => $e->getMessage()],
                500
            );
        }
    }
    public function acceptRequest(Request $req)
    {
        // try {
        //     $status = $req->status;
        //     $approval = $req->approval;

        //     if (is_array($status)) {
        //         $status = json_encode($status);
        //     } elseif (!is_string($status)) {
        //         throw new \Exception(
        //             "Invalid status format: " . gettype($status)
        //         );
        //     }

        //     if (is_array($approval)) {
        //         $approval = json_encode($approval);
        //     } elseif (!is_string($approval)) {
        //         throw new \Exception(
        //             "Invalid approval format: " . gettype($approval)
        //         );
        //     }
        //     $result = aw_drom_dataMdl::where("id", $req->id)->update([
        //         "status" => $status,
        //         "approval" => $approval,
        //     ]);

        //     $item = aw_drom_dataMdl::find($req->id);
        //     if (!$item) {
        //         throw new \Exception("Record not found after update");
        //     }

        //     $dataAppFlow = $this->safeJsonDecode($req->dataAppFlow);
        //     $currentUser = $req->currentUser;
        //     if (is_string($currentUser)) {
        //         $currentUser = json_decode($currentUser, true);
        //     }
        //     if (!is_array($currentUser)) {
        //         throw new \Exception(
        //             "Invalid currentUser format: " . gettype($currentUser)
        //         );
        //     }

        //     $targetLevel = $req->targetLevel ?? null;
        //     $levelInfo = $this->getLevelInfo(
        //         $currentUser["empno"],
        //         $dataAppFlow,
        //         $targetLevel
        //     );

        //     if (!$levelInfo) {
        //         throw new \Exception("User not authorized for this level");
        //     }

        //     $isLastLevel = $levelInfo["index"] >= count($dataAppFlow) - 1;
        //     $nextIndex = isset($levelInfo["nextValidIndex"])
        //         ? $levelInfo["nextValidIndex"]
        //         : $levelInfo["index"] + 1;

        //     $debugInfo = [
        //         "current_level" => [
        //             "index" => $levelInfo["index"],
        //             "level" => $levelInfo["level"],
        //             "name" => $this->getDenierLevel($levelInfo["index"]),
        //         ],
        //         "next_level" => $isLastLevel
        //             ? "None (Final Level)"
        //             : [
        //                 "index" => $nextIndex,
        //                 "name" => $this->getDenierLevel($nextIndex),
        //             ],
        //         "is_last_level" => $isLastLevel,
        //     ];

        //     $submitter = json_decode($item->submitter, true);
        //     $nameArray = json_decode($item->name, true);

        //     $occupants = $this->formatOccupantsData($nameArray);

        //     $emailData = [
        //         "department" => $submitter["dept"] ?? "",
        //         "occupants" => $occupants,
        //         "count" => count($occupants),
        //         "link" => "http://gmo021.cansportsvg.com/aw/ga/dma",
        //         "location" => !empty($occupants[0]["location"])
        //             ? $occupants[0]["location"]
        //             : "",
        //         "gender" => !empty($occupants[0]["gender"])
        //             ? $occupants[0]["gender"]
        //             : "",
        //         "reason" => $item->reason,
        //     ];

        //     if (
        //         !$isLastLevel &&
        //         isset($dataAppFlow[$nextIndex]) &&
        //         isset($dataAppFlow[$nextIndex]["managers"])
        //     ) {
        //         $nextManagers = collect(
        //             $dataAppFlow[$nextIndex]["managers"]
        //         )->pluck("email");
        //         $emailContent = view("AwDorm-approval", $emailData)->render();

        //         try {
        //             $this->sendNotification(
        //                 "VG-EXPAT-PS-TESTING",
        //                 $emailContent,
        //                 $nextManagers->toArray()
        //             );
        //         } catch (\Exception $e) {
        //         }
        //     } else {
        //         $emailContent = $this->buildSubmitterMessage($submitter, $item);
        //         try {
        //             $this->sendNotification(
        //                 "VG-EXPAT-PS-TESTING",
        //                 $emailContent,
        //                 [$submitter["email"]]
        //             );
        //         } catch (\Exception $e) {
        //         }
        //     }
        //     return response()->json([
        //         "success" => true,
        //         "message" => "Request accepted successfully",
        //         "debug" => $debugInfo,
        //     ]);
        // } catch (\Exception $e) {
        //     return response()->json(
        //         [
        //             "success" => false,
        //             "message" => "Failed to accept request",
        //             "error" => $e->getMessage(),
        //         ],
        //         500
        //     );
        // }
        try {
            $item = aw_drom_dataMdl::find($req->id);
            if (!$item) {
                throw new \Exception('Record not found');
            }

            $dataAppFlow = $this->safeJsonDecode($req->dataAppFlow);
            $currentUser = $req->currentUser;
            if (is_string($currentUser)) {
                $currentUser = json_decode($currentUser, true);
            }
            if (!is_array($currentUser)) {
                throw new \Exception('Invalid currentUser format: ' . gettype($currentUser));
            }

            $targetLevel = $req->targetLevel ?? null;
            // Build empno list: include both empno and group (alias empno used in dataAppFlow)
            $empnoList = array_values(array_unique(array_filter([
                $currentUser['empno'] ?? null,
                $currentUser['group'] ?? null,
            ])));
            $levelInfo = $this->getLevelInfo($empnoList, $dataAppFlow, $targetLevel);

            if (!$levelInfo) {
                throw new \Exception('User not authorized for this level');
            }

            $levelIndex = $levelInfo['index'];

            $statusArr  = json_decode($item->status, true) ?? [];
            $approvalArr = json_decode($item->approval, true) ?? [];

            $lvlCodeMap = ['dept', 'ga', 'smp', 'gm'];
            $statusKey = $lvlCodeMap[$levelIndex] ?? null;

            if ($statusKey !== null && isset($statusArr[$levelIndex])) {
                $statusArr[$levelIndex][$statusKey] = 'true';
                $statusArr[$levelIndex]['stt'] = 'accept';
            }

            if (isset($approvalArr[$levelIndex])) {
                $approvalArr[$levelIndex] = [
                    'empno'  => $currentUser['empno'] ?? '',
                    'name'   => $currentUser['name'] ?? '',
                    'reason' => '',
                    'email'  => $currentUser['email'] ?? '',
                    'date'   => now()->format('Y-m-d H:i:s'),
                    'stt'    => 'accept',
                ];
            }

            $newStatus   = json_encode($statusArr);
            $newApproval = json_encode($approvalArr);

            $result = aw_drom_dataMdl::where('id', $req->id)
                ->update([
                    'status'   => $newStatus,
                    'approval' => $newApproval,
                ]);

            $item = aw_drom_dataMdl::find($req->id);
            if (!$item) {
                throw new \Exception('Record not found after update');
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
                'link' => "http://gmo021.cansportsvg.com/aw/ga/dma",
                'location' => !empty($occupants[0]['location']) ? $occupants[0]['location'] : '',
                'gender' => !empty($occupants[0]['gender']) ? $occupants[0]['gender'] : '',
                'reason' => $item->reason
            ];

            if (!$isLastLevel && isset($dataAppFlow[$nextIndex]) && isset($dataAppFlow[$nextIndex]['managers'])) {
                $nextManagers = collect($dataAppFlow[$nextIndex]['managers'])->pluck('email');
                $emailContent = view('AwDorm-approval', $emailData)->render();

                try {
                    $this->sendNotification(
                        'VG-EXPAT-PS-TESTING',
                        $emailContent,
                        $nextManagers->toArray()
                    );
                } catch (\Exception $e) {
                    \Log::warning('Notification timeout, continuing: ' . $e->getMessage());
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
                    \Log::warning('Notification timeout, continuing: ' . $e->getMessage());
                }
            }
            return response()->json([
                'success' => true,
                'message' => 'Request accepted successfully',
                'debug' => $debugInfo
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
                throw new \Exception("Missing request ID");
            }

            $item = aw_drom_dataMdl::findOrFail($req->id);

            $status = is_string($req->status)
                ? $req->status
                : json_encode($req->status);
            if (!$status) {
                throw new \Exception("Invalid status data");
            }

            $approval = is_string($req->approval)
                ? $req->approval
                : json_encode($req->approval);
            if (!$approval) {
                throw new \Exception("Invalid approval data");
            }

            $result = $item->update([
                "status" => $status,
                "approval" => $approval,
            ]);

            if (!$result) {
                throw new \Exception("Failed to update database record");
            }

            $submitter = json_decode($item->submitter, true);
            $nameArray = json_decode($item->name, true);
            $approvalArray = json_decode($approval, true);

            if (!is_array($approvalArray)) {
                throw new \Exception("Invalid approval array format");
            }

            $lastApproval = collect($approvalArray)
                ->filter(function ($a) {
                    return !empty($a["reason"]) && $a["stt"] === "deny";
                })
                ->last();

            // if (!$lastApproval) {
            //     throw new \Exception('No valid denial information found');
            // }

            $emailData = [
                "submitter_name" => $submitter["name"] ?? "",
                "denier_level" => $this->getDenierLevel(
                    array_search($lastApproval, $approvalArray)
                ),
                "department" => $submitter["dept"] ?? "",
                "deny_reason" => $lastApproval["reason"] ?? "",
                "link" => "http://gmo021.cansportsvg.com/aw/ga/dma",
                "occupants" => $this->formatOccupantsData($nameArray),
            ];
            if (isset($submitter["email"])) {
                $emailContent = view(
                    "AwDorm-request-denied",
                    $emailData
                )->render();
                $this->sendNotification("VG-EXPAT-PS-TESTING", $emailContent, [
                    $submitter["email"],
                ]);
            }
            return response()->json([
                "success" => true,
                "message" => "Request denied successfully",
            ]);
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => "Failed to deny request",
                    "error" => $e->getMessage(),
                ],
                500
            );
        }
    }
    private function formatOccupantsData($nameArray, $reason = "")
    {
        try {
            if (!is_array($nameArray)) {
                return ["abc"];
            }
            return collect($nameArray)
                ->map(function ($person) use ($reason) {
                    if (!is_array($person)) {
                        return $this->getDefaultOccupantData();
                    }

                    // Extract location value correctly
                    $location = "";
                    if (isset($person["location"])) {
                        if (
                            is_array($person["location"]) &&
                            isset($person["location"]["loc"])
                        ) {
                            $location = $person["location"]["loc"];
                        } elseif (is_string($person["location"])) {
                            $location = $person["location"];
                        }
                    }

                    $gender = isset($person["gender"])
                        ? (strtoupper($person["gender"]) === "M"
                            ? "Nam/男"
                            : "Nữ/女")
                        : "";

                    $id_number = "";
                    if (!empty($person["citizen_id"])) {
                        $id_number = $person["citizen_id"];
                    } elseif (!empty($person["passport_number"])) {
                        $id_number = $person["passport_number"];
                    }

                    return [
                        "name" => (string) ($person["name"] ?? ""),
                        "nation" => $this->getLocalizedNation(
                            $person["nation"] ?? ""
                        ),
                        "raw_nation" => (string) ($person["nation"] ?? ""),
                        "location" => $location,
                        "gender" => $gender,
                        "birth_date" => (string) ($person["dateBirth"] ?? ""),
                        "id_number" => $id_number,
                        "start_date" => (string) ($person["start_date"] ?? ""),
                        "end_date" => (string) ($person["end_date"] ?? ""),
                        "note" => (string) ($person["note"] ?? ""),
                        "room_no" => (string) ($person["room_no"] ?? ""),
                        "reason" => (string) $reason,
                    ];
                })
                ->all();
        } catch (\Exception $e) {
            \Log::error("Error in formatOccupantsData: " . $e->getMessage());
            return ["abc"];
        }
    }

    private function getDenierLevel($index)
    {
        $levels = [
            0 => "Department Level/部門",
            1 => "Division Level/處級",
            2 => "GA Level/總經理處",
            3 => "SMP Level/總經理",
        ];
        return $levels[$index] ?? "Unknown Level";
    }
    private function getDefaultOccupantData()
    {
        return [
            "name" => "",
            "nation" => "",
            "location" => "",
            "gender" => "",
            "start_date" => "",
            "end_date" => "",
            "note" => "",
            "room_no" => "",
        ];
    }

    public function getDormLoc()
    {
        return ["dormLoc" => aw_dormLocMdl::orderBy("id", "asc")->get()];
    }
    public function getDormNation()
    {
        return [
            "dormNation" => aw_dormNationMdl::orderBy("id", "asc")->get(),
            "dormNationSub" => aw_dormNationMdl_sub::orderBy(
                "id",
                "asc"
            )->get(),
        ];
    }
    public function updateRoom(Request $req)
    {
        try {
            $result = aw_drom_dataMdl::where("id", $req->id)->update([
                "room_no" => $req->room_no,
            ]);

            return response()->json([
                "success" => true,
                "message" => "Room updated successfully",
            ]);
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => "Failed to update room",
                    "error" => $e->getMessage(),
                ],
                500
            );
        }
    }
    public function updateQRCode(Request $req)
    {
        try {
            $req->validate([
                "id" => "required",
                "qr_code" => "required|array",
            ]);

            $qrArray = [];
            foreach ($req->qr_code as $person) {
                if (
                    preg_match(
                        '/^data:image\/(?<type>.+);base64,(?<data>.+)$/',
                        $person["qr"],
                        $matches
                    )
                ) {
                    $imageData = base64_decode($matches["data"]);
                    $fileName =
                        "dma/" .
                        $req->id .
                        "_" .
                        Str::slug($person["name"]) .
                        "_" .
                        Str::random(5) .
                        ".png";
                    Storage::put($fileName, $imageData);

                    $qrArray[] = [
                        "name" => $person["name"],
                        "qr" => $fileName,
                    ];
                }
            }

            $dormData = aw_drom_dataMdl::find($req->id);
            if (!$dormData) {
                return response()->json(["message" => "Record not found"], 404);
            }

            $dormData->qr_code = json_encode($qrArray);
            $dormData->save();

            return response()->json(
                [
                    "success" => true,
                    "message" => "QR codes saved successfully",
                ],
                200
            );
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => $e->getMessage(),
                ],
                500
            );
        }
    }

    public function getQRCode($appname = null, $id = null, $name = null)
    {
        try {
            if (strpos($id, "_") !== false) {
                $filename = "dma/" . $id;
                $path = storage_path("app/" . $filename);

                if (!file_exists($path)) {
                    return response()->json(
                        ["error" => "QR code file not found"],
                        404
                    );
                }

                return response()->file($path, [
                    "Content-Type" => "image/png",
                    "Content-Disposition" => "inline",
                    "Cache-Control" => "no-cache, no-store, must-revalidate",
                    "Pragma" => "no-cache",
                    "Expires" => "0",
                ]);
            }

            if (!$id) {
                return response()->json(["error" => "ID is required"], 400);
            }

            $data = aw_drom_dataMdl::find($id);
            if (!$data || !$data->qr_code) {
                return response()->json(
                    ["error" => "QR code data not found"],
                    404
                );
            }

            $qrCodes = json_decode($data->qr_code, true);
            if (!is_array($qrCodes)) {
                return response()->json(
                    ["error" => "Invalid QR code data"],
                    400
                );
            }

            $qrInfo = null;
            if ($name) {
                foreach ($qrCodes as $qr) {
                    if ($qr["name"] === $name) {
                        $qrInfo = $qr;
                        break;
                    }
                }
            } else {
                $qrInfo = $qrCodes[0] ?? null;
            }

            if (!$qrInfo || !isset($qrInfo["qr"])) {
                return response()->json(["error" => "QR code not found"], 404);
            }

            $path = storage_path("app/" . $qrInfo["qr"]);
            if (!file_exists($path)) {
                return response()->json(
                    ["error" => "QR code file not found"],
                    404
                );
            }

            return response()->file($path, [
                "Content-Type" => "image/png",
                "Content-Disposition" => "inline",
                "Cache-Control" => "no-cache, no-store, must-revalidate",
                "Pragma" => "no-cache",
                "Expires" => "0",
            ]);
        } catch (\Exception $e) {
            return response()->json(
                ["error" => "Failed to retrieve QR code"],
                500
            );
        }
    }

    private function buildEmailMessage($item, $currentUser, $level)
    {
        try {
            $itemArray = is_object($item) ? $item->toArray() : $item;

            $nameData = [];
            if (isset($itemArray["name"])) {
                if (is_array($itemArray["name"])) {
                    $nameData = $itemArray["name"];
                } elseif (is_string($itemArray["name"])) {
                    $decoded = json_decode($itemArray["name"], true);
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

            $rows = collect($nameData)
                ->map(function ($person) {
                    if (!is_array($person)) {
                        return [
                            "name" => "",
                            "nation" => "",
                            "location" => "",
                            "gender" => "Male/男",
                            "start_date" => "",
                            "end_date" => "",
                            "note" => "-",
                        ];
                    }

                    return [
                        "name" => strval($person["name"] ?? ""),
                        "nation" => strval(
                            $this->getLocalizedNation($person["nation"] ?? "")
                        ),
                        "location" => strval($person["location"] ?? ""),
                        "gender" =>
                            isset($person["gender"]) &&
                            $person["gender"] === "F"
                                ? "Female/女"
                                : "Male/男",
                        "start_date" => strval($person["start_date"] ?? ""),
                        "end_date" => strval($person["end_date"] ?? ""),
                        "note" => strval($person["note"] ?? "-"),
                    ];
                })
                ->toArray();

            $dept = "";
            if (isset($currentUser["dept"])) {
                $dept = is_string($currentUser["dept"])
                    ? $currentUser["dept"]
                    : "";
            }

            $viewData = [
                "dept" => $dept,
                "count" => count($nameData),
                "rows" => $rows,
                "level" => strval($level),
                "link" => "http://gmo021.cansportsvg.com/aw/ga/dma",
            ];

            return view("AwDorm-approval", $viewData)->render();
        } catch (\Exception $e) {
            throw $e;
        }
    }
    private function generateVisaXml($occupants, $filename = null)
    {
        try {
            $foreignOccupants = array_filter($occupants, function ($occupant) {
                return isset($occupant["raw_nation"]) &&
                    $occupant["raw_nation"] !== "VNM";
            });

            // If no foreign occupants, return null
            if (empty($foreignOccupants)) {
                return null;
            }

            // Create XML document
            $xml = new \SimpleXMLElement(
                '<?xml version="1.0" encoding="UTF-8"?><KHAI_BAO_TAM_TRU></KHAI_BAO_TAM_TRU>'
            );

            // Add occupants
            foreach ($foreignOccupants as $index => $occupant) {
                $khach = $xml->addChild("THONG_TIN_KHACH");
                $khach->addChild("so_thu_tu", $index + 1);
                $khach->addChild(
                    "ho_ten",
                    htmlspecialchars($occupant["name"] ?? "")
                );
                $khach->addChild(
                    "ngay_sinh",
                    isset($occupant["birth_date"])
                        ? date("d/m/Y", strtotime($occupant["birth_date"]))
                        : ""
                );
                $khach->addChild("ngay_sinh_dung_den", "D");

                // Convert gender to required format
                $gender = "";
                if (
                    strpos($occupant["gender"] ?? "", "Nam") !== false ||
                    strpos($occupant["gender"] ?? "", "男") !== false ||
                    strpos($occupant["gender"] ?? "", "M") !== false
                ) {
                    $gender = "M";
                } elseif (
                    strpos($occupant["gender"] ?? "", "Nữ") !== false ||
                    strpos($occupant["gender"] ?? "", "女") !== false ||
                    strpos($occupant["gender"] ?? "", "F") !== false
                ) {
                    $gender = "F";
                }
                $khach->addChild("gioi_tinh", $gender);

                $khach->addChild("ma_quoc_tich", $occupant["raw_nation"] ?? "");
                $khach->addChild("so_ho_chieu", $occupant["id_number"] ?? "");
                $khach->addChild("so_phong", $occupant["room_no"] ?? "");
                $khach->addChild(
                    "ngay_den",
                    isset($occupant["start_date"])
                        ? date("d/m/Y", strtotime($occupant["start_date"]))
                        : ""
                );
                $khach->addChild(
                    "ngay_di_du_kien",
                    isset($occupant["end_date"])
                        ? date("d/m/Y", strtotime($occupant["end_date"]))
                        : ""
                );
                $khach->addChild(
                    "ngay_tra_phong",
                    isset($occupant["end_date"])
                        ? date("d/m/Y", strtotime($occupant["end_date"]))
                        : ""
                );
            }

            // Save XML file
            $filename = $filename ?? "visa_info.xml";
            $xmlPath = storage_path("app/awdma/" . $filename);

            // Ensure directory exists
            if (!file_exists(dirname($xmlPath))) {
                mkdir(dirname($xmlPath), 0755, true);
            }

            // Save with proper formatting
            $dom = new \DOMDocument("1.0");
            $dom->preserveWhiteSpace = false;
            $dom->formatOutput = true;
            $dom->loadXML($xml->asXML());
            $dom->save($xmlPath);

            return $xmlPath;
        } catch (\Exception $e) {
            \Log::error("XML generation error: " . $e->getMessage());
            return null;
        }
    }
    public function generateVisaExcel($occupants, $filename = null)
    {
        try {
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();

            // Set headers
            $headers = [
                "STT",
                "Họ và tên",
                "Ngày sinh",
                "QT",
                "Số HC",
                "Ngày đến",
                "Ngày đi DK",
                "Ngày trả phòng",
            ];
            $sheet->fromArray($headers, null, "A1");

            // Style headers
            $headerStyle = [
                "font" => ["bold" => true],
                "alignment" => ["horizontal" => Alignment::HORIZONTAL_CENTER],
                "borders" => [
                    "allBorders" => ["borderStyle" => Border::BORDER_THIN],
                ],
            ];
            $sheet->getStyle("A1:H1")->applyFromArray($headerStyle);

            // Add data
            $row = 2;
            foreach ($occupants as $index => $occupant) {
                $data = [
                    $index + 1,
                    $occupant["name"] ?? "",
                    isset($occupant["birth_date"])
                        ? date("d/m/Y", strtotime($occupant["birth_date"]))
                        : "",
                    $occupant["nation"] ?? "",
                    $occupant["id_number"] ?? "",
                    isset($occupant["start_date"])
                        ? date("d/m/Y", strtotime($occupant["start_date"]))
                        : "",
                    isset($occupant["end_date"])
                        ? date("d/m/Y", strtotime($occupant["end_date"]))
                        : "",
                    isset($occupant["end_date"])
                        ? date("d/m/Y", strtotime($occupant["end_date"]))
                        : "",
                ];

                $sheet->fromArray($data, null, "A" . $row);
                $sheet->getStyle("A" . $row . ":H" . $row)->applyFromArray([
                    "borders" => [
                        "allBorders" => ["borderStyle" => Border::BORDER_THIN],
                    ],
                ]);
                $row++;
            }

            // Auto-size columns
            foreach (range("A", "H") as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            // Save to temp file
            $filename = $filename ?? "申報公安匯入檔.xlsx";
            $tempPath = storage_path("app/awdma/" . $filename);

            // Ensure temp directory exists
            if (!file_exists(dirname($tempPath))) {
                mkdir(dirname($tempPath), 0755, true);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save($tempPath);

            return $tempPath;
        } catch (\Exception $e) {
            \Log::error("Excel generation error: " . $e->getMessage());
            return null;
        }
    }
    private function generateAccommodationExcel($occupants, $filename = null)
    {
        try {
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();

            // Set page orientation to landscape
            $sheet
                ->getPageSetup()
                ->setOrientation(
                    \PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE
                );

            // Merge cells for headers
            $sheet->mergeCells("A1:P3");
            $sheet->setCellValue(
                "A1",
                "SỔ TIẾP NHẬN LƯU TRÚ\nXã TÓC TIÊN\nCÔNG TY TNHH  QUỐC TẾ  ALL WELLS VIỆT NAM"
            );

            // Style for main header
            $sheet->getStyle("A1:P3")->applyFromArray([
                "font" => [
                    "bold" => true,
                    "size" => 14,
                ],
                "alignment" => [
                    "horizontal" => Alignment::HORIZONTAL_CENTER,
                    "vertical" => Alignment::VERTICAL_CENTER,
                    "wrapText" => true,
                ],
            ]);

            // Set row height for header
            $sheet->getRowDimension("1")->setRowHeight(60);

            // Add regulation text - Updated to span K4:M6 without borders
            $sheet->setCellValue("K4", "Quyển số 數:");
            $sheet->setCellValue("K5", "- Bút dầu ngày藍色日期:");
            $sheet->setCellValue("K6", "- Kết thúc ngày黃色日期:");

            $sheet->getStyle("K4:K6")->applyFromArray([
                "font" => ["size" => 10],
                "alignment" => [
                    "horizontal" => Alignment::HORIZONTAL_LEFT,
                    "vertical" => Alignment::VERTICAL_TOP,
                    "wrapText" => true,
                ],
            ]);
            $sheet->insertNewRowBefore(7, 1);
            // Headers for the table (Row 7)
            $headers = [
                "STT 序號",
                "HỌ VÀ TÊN 姓名",
                "NGÀY/THÁNG/NĂM SINH 出生日期",
                "GIỚI TÍNH 性別",
                "CMND/HỘ CHIEU 身份證/護照號碼",
                "NGHỀ NGHIỆP, NƠI LÀM VIỆC 職業，工作地點",
                "DÂN TỘC 民族",
                "QUỐC TỊCH 國籍",
                "NƠI THƯỜNG TRÚ/TẠM TRÚ 戶籍地/暫住地址",
                "LÝ DO LƯU TRÚ 居留原因",
                "THỜI GIAN LƯU TRÚ 居留期間",
                "ĐỊA CHỈ LƯU TRÚ 居留地址",
                "HÌNH THỨC, THỜI GIAN THÔNG BÁO 通知時間",
                "HỌ VÀ TÊN CÁN BỘ TIẾP NHẬN 接收人",
                "GHI CHÚ 備註",
            ];

            // Merge cells for "THỜI GIAN LƯU TRÚ" header
            $sheet->mergeCells("K7:L7");
            $sheet->setCellValue("K7", $headers[10]);

            // Set individual headers
            $headerColumns = [
                "A",
                "B",
                "C",
                "D",
                "E",
                "F",
                "G",
                "H",
                "I",
                "J",
                "M",
                "N",
                "O",
                "P",
            ];
            foreach ($headerColumns as $index => $col) {
                if ($col !== "L") {
                    // Skip L as it's merged with K
                    $headerIndex = $index >= 10 ? $index + 1 : $index;
                    if ($headerIndex < count($headers)) {
                        $sheet->setCellValue(
                            $col . "7",
                            $headers[$headerIndex]
                        );
                    }
                }
            }

            // Style headers
            $headerStyle = [
                "font" => ["bold" => true, "size" => 10],
                "alignment" => [
                    "horizontal" => Alignment::HORIZONTAL_CENTER,
                    "vertical" => Alignment::VERTICAL_CENTER,
                    "wrapText" => true,
                ],
                "borders" => [
                    "allBorders" => ["borderStyle" => Border::BORDER_THIN],
                ],
                "fill" => [
                    "fillType" =>
                        \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    "startColor" => ["rgb" => "FFFF00"], // Yellow background
                ],
            ];

            // Apply header style only to row 7
            $sheet->getStyle("A7:P7")->applyFromArray($headerStyle);

            // Set column widths
            $columnWidths = [
                "A" => 8, // STT
                "B" => 15, // Họ tên
                "C" => 12, // Ngày sinh
                "D" => 8, // Giới tính
                "E" => 15, // CMND/Hộ chiếu
                "F" => 20, // Nghề nghiệp
                "G" => 10, // Dân tộc
                "H" => 10, // Quốc tịch
                "I" => 25, // Nơi thường trú
                "J" => 15, // Lý do lưu trú
                "K" => 12, // Bắt đầu
                "L" => 12, // Kết thúc
                "M" => 20, // Địa chỉ lưu trú
                "N" => 12, // Thời gian thông báo
                "O" => 15, // Cán bộ tiếp nhận
                "P" => 15, // Ghi chú
            ];

            foreach ($columnWidths as $col => $width) {
                $sheet->getColumnDimension($col)->setWidth($width);
            }

            // Set row heights
            $sheet->getRowDimension("7")->setRowHeight(40);

            // Add data starting from row 8
            $row = 8;
            foreach ($occupants as $index => $occupant) {
                // Convert gender format
                $gender = "";
                if (
                    strpos($occupant["gender"] ?? "", "Nam") !== false ||
                    strpos($occupant["gender"] ?? "", "男") !== false ||
                    strtoupper($occupant["gender"] ?? "") === "M"
                ) {
                    $gender = "Male";
                } elseif (
                    strpos($occupant["gender"] ?? "", "Nữ") !== false ||
                    strpos($occupant["gender"] ?? "", "女") !== false ||
                    strtoupper($occupant["gender"] ?? "") === "F"
                ) {
                    $gender = "Female";
                }

                $data = [
                    $index + 1, // STT
                    $occupant["name"] ?? "", // Họ tên
                    isset($occupant["birth_date"])
                        ? date("d/m/Y", strtotime($occupant["birth_date"]))
                        : "", // Ngày sinh
                    $gender, // Giới tính
                    $occupant["id_number"] ?? "", // CMND/Hộ chiếu
                    $occupant["location"] ?? "", // Nghề nghiệp
                    "-", // Dân tộc (default)
                    $occupant["nation"] ?? "", // Quốc tịch
                    "-", // Nơi thường trú (empty)
                    $occupant["reason"] ?? "", // Lý do lưu trú
                    isset($occupant["start_date"])
                        ? date("d/m/Y", strtotime($occupant["start_date"]))
                        : "", // Bắt đầu
                    isset($occupant["end_date"])
                        ? date("d/m/Y", strtotime($occupant["end_date"]))
                        : "", // Kết thúc
                    "", // Địa chỉ lưu trú
                    "", // Thời gian thông báo (current date)
                    "", // Cán bộ tiếp nhận (empty)
                    $occupant["note"] ?? "", // Ghi chú
                ];

                $columns = [
                    "A",
                    "B",
                    "C",
                    "D",
                    "E",
                    "F",
                    "G",
                    "H",
                    "I",
                    "J",
                    "K",
                    "L",
                    "M",
                    "N",
                    "O",
                    "P",
                ];
                foreach ($columns as $colIndex => $col) {
                    $sheet->setCellValue($col . $row, $data[$colIndex]);
                }

                // Style data rows
                $sheet->getStyle("A" . $row . ":P" . $row)->applyFromArray([
                    "borders" => [
                        "allBorders" => ["borderStyle" => Border::BORDER_THIN],
                    ],
                    "alignment" => [
                        "horizontal" => Alignment::HORIZONTAL_CENTER,
                        "vertical" => Alignment::VERTICAL_CENTER,
                        "wrapText" => true,
                    ],
                ]);

                $sheet->getRowDimension($row)->setRowHeight(25);
                $row++;
            }

            // Save file
            $filename =
                $filename ?? "so_tiep_nhan_luu_tru_" . date("YmdHis") . ".xlsx";
            $excelPath = storage_path("app/awdma/" . $filename);

            // Ensure directory exists
            if (!file_exists(dirname($excelPath))) {
                mkdir(dirname($excelPath), 0755, true);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save($excelPath);

            return $excelPath;
        } catch (\Exception $e) {
            \Log::error(
                "Accommodation Excel generation error: " . $e->getMessage()
            );
            return null;
        }
    }
    private function buildSubmitterMessage($submitter, $item)
    {
        try {
            $link = "http://gmo021.cansportsvg.com/aw/ga/dma";
            $qrCodeUrl =
                "http://gmo021.cansportsvg.com/api/awDorm/getQRCode/dma/" .
                $item->id;

            $nameArray = json_decode($item->name, true);
            $occupants = $this->formatOccupantsData($nameArray, $item->reason);

            $msgCtrl = new msgCenterCtrl();

            $bccMsgId = new Request();
            $bccMsgId->merge(["msgId" => "AW-DMA-HR"]);
            $bccMails = $msgCtrl->getEmailByMsgId($bccMsgId);

            if ($bccMails == "wrong msg_id" || !is_array($bccMails)) {
                $bccMails = [];
            }

            $visaBccMsgId = new Request();
            $visaBccMsgId->merge(["msgId" => "AW-DMA-VISA"]);
            $visaBccMails = $msgCtrl->getEmailByMsgId($visaBccMsgId);

            if ($visaBccMails == "wrong msg_id" || !is_array($visaBccMails)) {
                $visaBccMails = [];
            }

            $currentDate = date("n/j");

            $mailData = [
                "subject" => "[DMA] Dormitory Application",
                "to" => array_merge([$submitter["email"]], $bccMails),
                "name" => $submitter["name"],
                "dept" => $submitter["dept"],
                "link" => $link,
                "qrCodeUrl" => $qrCodeUrl,
                "occupants" => $occupants,
            ];

            $mailRecord = new Request();
            $mailRecord->merge([
                "target" => "AW-DMA-HR",
                "msg_type" => "m",
                "msg_method" => "email",
                "mail_template" => "AwDormrequest-completed",
                "msg_subject" => "[DMA] Dormitory Application",
                "mail_data" => json_encode($mailData),
            ]);

            $result = $msgCtrl->sendOutMsg($mailRecord);

            // Generate Excel files
            $excelPath = $this->generateVisaExcel($occupants, "visa_info.xlsx");
            $xmlPath = $this->generateVisaXml($occupants, "visa_info.xml");
            // Generate new accommodation Excel
            $accommodationExcelPath = $this->generateAccommodationExcel(
                $occupants,
                "accommodation_register.xlsx"
            );

            $visaMailData = [
                "subject" => "[DMA] {$currentDate} AW 核准暫住資訊 / AW phê duyệt thông tin tạm trú / AW Approved Temporary Residence Info",
                "to" => array_merge([$submitter["email"]], $visaBccMails),
                "occupants" => $occupants,
            ];

            // Add all attachments
            $attachments = [];
            if ($excelPath && file_exists($excelPath)) {
                $attachments[] = $excelPath;
            }
            if ($xmlPath && file_exists($xmlPath)) {
                $attachments[] = $xmlPath;
            }
            if (
                $accommodationExcelPath &&
                file_exists($accommodationExcelPath)
            ) {
                $attachments[] = $accommodationExcelPath;
            }

            if (!empty($attachments)) {
                $visaMailData["attachments"] = implode("|", $attachments);
            }

            $visaMailRecord = new Request();
            $visaMailRecord->merge([
                "target" => "AW-DMA-VISA",
                "msg_type" => "m",
                "msg_method" => "email",
                "mail_template" => "AwDorm-visa-info",
                "msg_subject" => "[DMA] {$currentDate} AW 核准暫住資訊 / AW phê duyệt thông tin tạm trú / AW Approved Temporary Residence Info",
                "mail_data" => json_encode($visaMailData),
            ]);

            $visaResult = $msgCtrl->sendOutMsg($visaMailRecord);

            return view("AwDormrequest-completed", [
                "name" => $submitter["name"],
                "dept" => $submitter["dept"],
                "link" => $link,
                "qrCodeUrl" => $qrCodeUrl,
                "occupants" => $occupants,
            ])->render();
        } catch (\Exception $e) {
            return view("AwDormrequest-completed", [
                "name" => $submitter["name"] ?? "",
                "dept" => $submitter["dept"] ?? "",
                "link" => "http://gmo021.cansportsvg.com/aw/ga/dma",
                "qrCodeUrl" =>
                    "http://gmo021.cansportsvg.com/api/awDorm/getQRCode/dma/" .
                    $item->id,
                "occupants" => $this->formatOccupantsData(
                    json_decode($item->name ?? "[]", true),
                    $item->reason
                ),
            ])->render();
        }
    }

    private function sendEmailWithAttachment($mailData)
    {
        try {
            \Mail::send($mailData["template"], $mailData, function (
                $message
            ) use ($mailData) {
                $message->to($mailData["to"])->subject($mailData["subject"]);

                if (isset($mailData["bcc"]) && !empty($mailData["bcc"])) {
                    $message->bcc($mailData["bcc"]);
                }

                if (isset($mailData["attachments"])) {
                    foreach ($mailData["attachments"] as $attachment) {
                        $message->attach($attachment["path"], [
                            "as" => $attachment["name"],
                            "mime" => $attachment["mime"],
                        ]);
                    }
                }
            });

            return true;
        } catch (\Exception $e) {
            \Log::error("Email sending error: " . $e->getMessage());
            return false;
        }
    }

    private function sendNotification($target, $body, $recipients)
    {
        $mailData = [
            "to" => $recipients,
            "subject" => "Dormitory Application",
            "msgBody" => $body,
        ];

        $params = [
            "target" => $target,
            "body" => $body,
            "msg_type" => "m",
            "msg_method" => "both",
            "msg_subject" => "Dormitory Application",
            "mail_template" => "msgCenterMailTemplate",
            "mail_data" => json_encode($mailData),
        ];

        return $this->sendMsg($params);
    }

    private function getLocalizedNation($nationCode)
    {
        try {
            if (!$nationCode) {
                return "";
            }

            $nationItem = aw_dormNationMdl_sub::where(
                "code",
                $nationCode
            )->first();
            if (!$nationItem) {
                return "Nation Code: {$nationCode}";
            }

            $nationObj = json_decode($nationItem->nation, true);
            if (!$nationObj) {
                return "";
            }

            return $nationObj["en"] ?? "";
        } catch (\Exception $e) {
            return "Error: {$nationCode}";
        }
    }

    private function sendMsg($params)
    {
        try {
            $client = new \GuzzleHttp\Client();

            $formData = http_build_query($params);

            $response = $client->post(
                "http://gmo021.cansportsvg.com/api/msg-center/sendOutMsg",
                [
                    "headers" => [
                        "Content-Type" => "application/x-www-form-urlencoded",
                    ],
                    "body" => $formData,
                ]
            );

            return json_decode($response->getBody()->getContents(), true);
        } catch (\Exception $e) {
            throw $e;
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

    private function generateQRContent($item)
    {
        try {
            $submitter = json_decode($item->submitter, true);
            $nameArray = json_decode($item->name, true);

            $qrContent = implode(";", [
                $item->id,
                $submitter["empno"],
                $submitter["dept"],
                $item->key_in_date,
            ]);

            foreach ($nameArray as $occupant) {
                $location = "";
                if (
                    is_array($occupant["location"]) &&
                    isset($occupant["location"]["loc"])
                ) {
                    $location = $occupant["location"]["loc"];
                } elseif (is_string($occupant["location"])) {
                    $location = $occupant["location"];
                }

                $qrContent .=
                    ";" .
                    implode(";", [
                        $occupant["name"],
                        $this->getLocalizedNation($occupant["nation"]),
                        $location,
                        $occupant["start_date"],
                        $occupant["end_date"],
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
                "id" => "required",
                "name" => "required|json",
            ]);

            $dormData = aw_drom_dataMdl::findOrFail($req->id);
            $dormData->name = $req->name;

            $nameArray = json_decode($req->name, true);

            $qrArray = [];

            if (
                $req->has("qr_codes") &&
                is_array($req->qr_codes) &&
                !empty($req->qr_codes)
            ) {
                foreach ($req->qr_codes as $person) {
                    if (!isset($person["name"]) || !isset($person["qr"])) {
                        continue;
                    }

                    if (
                        preg_match(
                            '/^data:image\/(?<type>.+);base64,(?<data>.+)$/',
                            $person["qr"],
                            $matches
                        )
                    ) {
                        $imageData = base64_decode($matches["data"]);
                        $fileName =
                            "dma/" .
                            $req->id .
                            "_" .
                            Str::slug($person["name"]) .
                            "_" .
                            Str::random(5) .
                            ".png";

                        Storage::put($fileName, $imageData);

                        $qrArray[] = [
                            "name" => $person["name"],
                            "qr" => $fileName,
                        ];
                    }
                }
            } else {
                foreach ($nameArray as $person) {
                    $fileName =
                        "dma/" .
                        $req->id .
                        "_" .
                        Str::slug($person["name"] ?? "unknown") .
                        "_" .
                        Str::random(5) .
                        ".png";

                    $qrArray[] = [
                        "name" => $person["name"] ?? "Unknown",
                        "qr" => $fileName,
                    ];
                }
            }

            $dormData->qr_code = json_encode($qrArray);
            $dormData->save();

            return response()->json([
                "success" => true,
                "message" => "Room number updated successfully",
                "qr_filenames" => $qrArray,
            ]);
        } catch (ValidationException $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => "Validation failed",
                    "errors" => $e->errors(),
                ],
                422
            );
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => "Failed to update room and QR codes",
                    "error" => $e->getMessage(),
                ],
                500
            );
        }
    }
    public function sendNewRequestNotification(Request $request)
    {
        try {
            $request->validate([
                "target" => "required|string",
                "emailData" => "required|array",
                "managers" => "required|array",
            ]);

            $target = $request->target;
            $emailData = $request->emailData;
            $managers = $request->managers;

            $templateData = [
                "dept" => $emailData["dept"] ?? "",
                "count" => $emailData["count"] ?? 0,
                "rows" => $emailData["rows"] ?? [],
                "link" =>
                    $emailData["link"] ??
                    "http://gmo021.cansportsvg.com/aw/ga/dma",
            ];

            $emailContent = view("AwDorm-new-request", $templateData)->render();

            $mailData = [
                "to" => $managers,
                "subject" => "New Dormitory Application / 新宿舍申請",
                "msgBody" => $emailContent,
            ];

            $params = [
                "target" => $target,
                "body" => $emailContent,
                "msg_type" => "m",
                "msg_method" => "both",
                "msg_subject" => "New Dormitory Application / 新宿舍申請",
                "mail_template" => "msgCenterMailTemplate",
                "mail_data" => json_encode($mailData),
            ];

            $response = $this->sendMsg($params);

            return response()->json([
                "success" => true,
                "message" => "Notification sent successfully",
            ]);
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "error" => $e->getMessage(),
                ],
                500
            );
        }
    }
    public static function getFilteredRequests($userData, $includeDeputy = true)
    {
        $nationList = aw_dormNationMdl::all();
        $nationMap = [];
        foreach ($nationList as $nation) {
            $nationObj = json_decode($nation->nation, true);
            $nationMap[$nation->id] = $nationObj;
        }

        if (!isset($userData["empno"])) {
            return [
                "title" => "DMA",
                "color" => "orange",
                "data" => [],
                "processed" => [
                    "approved" => [],
                    "declined" => [],
                ],
                "url" => "http://gmo021.cansportsvg.com/aw/ga/dma",
            ];
        }

        $approvalFlow = $userData["flow_data"] ?? null;

        if (!$approvalFlow) {
            $dormCtrl = new self();
            $request = new Request();
            $request->merge([
                "empno" => $userData["empno"],
                "appCode" => "aw_dma_demo",
                "location" => $userData["location"] ?? "aw",
            ]);
            $flowResponse = json_decode($dormCtrl->getAppFlow($request)->getContent(), true);
            $approvalFlow = $flowResponse["result"]["flow_data"] ?? $flowResponse["flow_data"] ?? (is_array($flowResponse) ? $flowResponse : []);
        }

        $allRequests = aw_drom_dataMdl::orderBy("id", "desc")->get();
        // dd($allRequests);
        $filtered = [];
        $approved = [];
        $declined = [];

        foreach ($allRequests as $request) {
            try {
                if (
                    !$request ||
                    !isset($request->status) ||
                    !isset($request->approval)
                ) {
                    continue;
                }
                $status = is_array($request->status)
                    ? $request->status
                    : (is_string($request->status)
                        ? json_decode($request->status, true)
                        : null);

                $approval = is_array($request->approval)
                    ? $request->approval
                    : (is_string($request->approval)
                        ? json_decode($request->approval, true)
                        : null);

                $submitter = $request->submitter;
                if (is_string($submitter)) {
                    $submitter = json_decode($submitter, true);
                }
                $nameArr = $request->name;
                if (is_string($nameArr)) {
                    $nameArr = json_decode($nameArr, true);
                }
                if (
                    !$status ||
                    !$approval ||
                    !is_array($submitter) ||
                    !is_array($nameArr)
                ) {
                    continue;
                }

                $flowData = isset($request->flow_data)
                    ? $request->flow_data
                    : $approvalFlow;

                $occupants = [];
                if (is_array($nameArr)) {
                    foreach ($nameArr as $person) {
                        $nationId = isset($person["nation"])
                            ? $person["nation"]
                            : null;
                        $nationObj =
                            $nationId && isset($nationMap[$nationId])
                                ? $nationMap[$nationId]
                                : [];
                        $person["nation"] = isset($nationObj["en"])
                            ? $nationObj["en"]
                            : "";
                        $occupants[] = $person;
                    }
                }
                $targetLevel = null;
                if (
                    is_array($status) &&
                    isset($status[0]["dept"]) &&
                    $status[0]["dept"] === "false" &&
                    $status[0]["stt"] === "waiting dept"
                ) {
                    $targetLevel = 0;
                } elseif (
                    is_array($status) &&
                    isset($status[0]["dept"], $status[1]["ga"]) &&
                    $status[0]["dept"] === "true" &&
                    $status[0]["stt"] === "accept" &&
                    ($status[1]["ga"] === "false" ||
                        $status[1]["stt"] === "waiting ga")
                ) {
                    $targetLevel = 1;
                } elseif (
                    is_array($status) &&
                    isset($status[1]["ga"], $status[2]["smp"]) &&
                    $status[1]["ga"] === "true" &&
                    $status[1]["stt"] === "accept" &&
                    ($status[2]["smp"] === "false" ||
                        $status[2]["stt"] === "waiting smp")
                ) {
                    $targetLevel = 2;
                } elseif (
                    is_array($status) &&
                    isset($status[2]["smp"], $status[3]["gm"]) &&
                    $status[2]["smp"] === "true" &&
                    $status[2]["stt"] === "accept" &&
                    ($status[3]["gm"] === "false" ||
                        $status[3]["stt"] === "waiting gm")
                ) {
                    $targetLevel = 3;
                }

                // Kiểm tra quyền duyệt
                $canApprove = false;
                if ($targetLevel !== null && isset($flowData[$targetLevel])) {
                    $currentLevel = $flowData[$targetLevel];
                    if (isset($currentLevel["managers"])) {
                        foreach ($currentLevel["managers"] as $manager) {
                            if (
                                strtoupper($manager["empno"]) ===
                                strtoupper($userData["empno"])
                            ) {
                                $canApprove = true;
                                break;
                            }
                            if ($includeDeputy && isset($manager["deputies"])) {
                                foreach ($manager["deputies"] as $deputy) {
                                    if (
                                        strtoupper($deputy["empno"]) ===
                                        strtoupper($userData["empno"])
                                    ) {
                                        $canApprove = true;
                                        break;
                                    }
                                }
                            }
                            if ($canApprove) {
                                break;
                            }
                        }
                    }
                }

                if ($canApprove) {
                    // Convert array to object
                    $filteredRequest = new \stdClass();
                    $filteredRequest->id = $request->id;
                    $filteredRequest->key_in_date = $request->key_in_date;
                    $filteredRequest->approval = is_array($approval)
                        ? $approval
                        : [];
                    $filteredRequest->status = $request->status;
                    $filteredRequest->submitter = $submitter;
                    $filteredRequest->name = $occupants;
                    $filteredRequest->reason = $request->reason;
                    $filteredRequest->created_at = $request->created_at;
                    $filteredRequest->updated_at = $request->updated_at;
                    $filteredRequest->targetLevel = $targetLevel;
                    $filteredRequest->flow_data = $flowData;
                    $filteredRequest->email = isset(
                        $currentLevel["managers"][0]["email"]
                    )
                        ? $currentLevel["managers"][0]["email"]
                        : "";

                    $filtered[] = $filteredRequest;
                }

                $isDenied = false;
                if (is_array($status) && is_array($approval)) {
                    foreach ($status as $idx => $level) {
                        if (
                            isset($level["stt"]) &&
                            strtolower($level["stt"]) === "deny"
                        ) {
                            // Sửa: chỉ cần kiểm tra đúng empno là user hiện tại, không cần phải đúng index
                            if (is_array($approval)) {
                                foreach ($approval as $appr) {
                                    if (
                                        isset($appr["empno"]) &&
                                        $appr["empno"] === $userData["empno"] &&
                                        isset($appr["stt"]) &&
                                        strtolower($appr["stt"]) === "deny"
                                    ) {
                                        $isDenied = true;
                                        break 2;
                                    }
                                }
                            }
                        }
                    }
                }
                if ($isDenied) {
                    $declinedRequest = new \stdClass();
                    $declinedRequest->id = $request->id;
                    $declinedRequest->key_in_date = $request->key_in_date;
                    $declinedRequest->approval = $approval;
                    $declinedRequest->status = $request->status;
                    $declinedRequest->submitter = $submitter;
                    $declinedRequest->name = $occupants;
                    $declinedRequest->reason = $request->reason;
                    $declinedRequest->created_at = $request->created_at;
                    $declinedRequest->updated_at = $request->updated_at;

                    $declined[] = $declinedRequest;
                    continue;
                }
                // Check approved
                if (is_array($approval)) {
                    foreach ($approval as $level) {
                        if (
                            isset($level["empno"]) &&
                            $level["empno"] === $userData["empno"] &&
                            strtolower($level["stt"]) === "accept"
                        ) {
                            // Convert array to object for approved
                            $approvedRequest = new \stdClass();
                            $approvedRequest->id = $request->id;
                            $approvedRequest->key_in_date =
                                $request->key_in_date;
                            $approvedRequest->approval = $approval;
                            $approvedRequest->status = $request->status;
                            $approvedRequest->submitter = $submitter;
                            $approvedRequest->name = $occupants;
                            $approvedRequest->reason = $request->reason;
                            $approvedRequest->created_at = $request->created_at;
                            $approvedRequest->updated_at = $request->updated_at;

                            $approved[] = $approvedRequest;
                            break;
                        }
                    }
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        return [
            "title" => "AW-DMA",
            "color" => "orange",
            "data" => collect($filtered),
            "processed" => [
                "approved" => collect($approved),
                "declined" => collect($declined),
            ],
            "url" => "http://gmo021.cansportsvg.com/aw/ga/dma",
        ];
    }
    public function getProcessedRequestsByEmpno(Request $req)
    {
        try {
            // Lấy danh sách nation và build map id => nationObj
            $nationList = aw_dormNationMdl::all();
            $nationMap = [];
            foreach ($nationList as $nation) {
                $nationObj = json_decode($nation->nation, true);
                $nationMap[$nation->id] = $nationObj;
            }

            $allRequests = aw_drom_dataMdl::orderBy("id", "DESC")
                ->limit(10)
                ->get([
                    "id",
                    "key_in_date",
                    "approval",
                    "status",
                    "submitter",
                    "name",
                    "reason",
                    "created_at",
                    "updated_at",
                ]);

            $processedRequests = [];
            $declinedRequests = [];

            foreach ($allRequests as $request) {
                $approval = json_decode($request->approval, true);
                $status = json_decode($request->status, true);

                $request->submitter = is_string($request->submitter)
                    ? json_decode($request->submitter, true)
                    : $request->submitter;
                $nameArr = is_string($request->name)
                    ? json_decode($request->name, true)
                    : $request->name;

                // Map nation cho occupants (chỉ lấy tiếng Anh)
                $occupants = [];
                if (is_array($nameArr)) {
                    foreach ($nameArr as $person) {
                        $nationId = isset($person["nation"])
                            ? $person["nation"]
                            : null;
                        $nationObj =
                            $nationId && isset($nationMap[$nationId])
                                ? $nationMap[$nationId]
                                : [];
                        $person["nation"] = isset($nationObj["en"])
                            ? $nationObj["en"]
                            : "";
                        $occupants[] = $person;
                    }
                }
                $request->name = $occupants;

                $isDenied = false;

                // Check if request is denied at any level
                foreach ($status as $index => $level) {
                    if (
                        isset($level["stt"]) &&
                        strtolower($level["stt"]) === "deny"
                    ) {
                        if (
                            isset($approval[$index]["empno"]) &&
                            $approval[$index]["empno"] === $req->empno
                        ) {
                            $declinedRequests[] = $request;
                            $isDenied = true;
                            break;
                        }
                    }
                }
                if ($isDenied) {
                    continue;
                }

                // Check approved requests
                if (!empty($approval)) {
                    foreach ($approval as $level) {
                        if (
                            isset($level["empno"]) &&
                            $level["empno"] === $req->empno
                        ) {
                            if (strtolower($level["stt"]) === "accept") {
                                $processedRequests[] = $request;
                            }
                            break;
                        }
                    }
                }
            }

            return response()->json([
                "success" => true,
                "data" => [
                    "approved" => $processedRequests,
                    "declined" => $declinedRequests,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "error" => $e->getMessage(),
                ],
                500
            );
        }
    }
    public function getAppFlow(Request $request)
    {
        try {
            $client = new \GuzzleHttp\Client();
            $response = $client->post(
                "http://gmo021.cansportsvg.com:10003/api/ifm-tracking/resolve",
                [
                    "json" => [
                        "empno" => $request->empno,
                        "location" => strtolower($request->location ?? "aw"),
                        "app_code" => $request->appCode ?? "aw_dma_demo",
                    ],
                ]
            );
            $flowData = json_decode($response->getBody()->getContents(), true);

            $flowDataRef = null;
            if (
                isset($flowData["result"]["flow_data"]) &&
                is_array($flowData["result"]["flow_data"])
            ) {
                $flowDataRef = &$flowData["result"]["flow_data"];
            } elseif (
                isset($flowData["flow_data"]) &&
                is_array($flowData["flow_data"])
            ) {
                $flowDataRef = &$flowData["flow_data"];
            } elseif (is_array($flowData)) {
                $flowDataRef = &$flowData;
            }

            if ($flowDataRef) {
                foreach ($flowDataRef as &$level) {
                    if (
                        isset($level["managers"]) &&
                        is_array($level["managers"])
                    ) {
                        $newManagers = [];
                        foreach ($level["managers"] as $manager) {
                            $newManagers[] = $manager;
                            if (
                                isset($manager["deputies"]) &&
                                is_array($manager["deputies"])
                            ) {
                                foreach ($manager["deputies"] as $deputy) {
                                    if (
                                        isset($deputy["status"]) &&
                                        ($deputy["status"] === true ||
                                            $deputy["status"] === 1)
                                    ) {
                                        $deputyName = $deputy["name"];
                                        if (
                                            strpos($deputyName, "@") !== false
                                        ) {
                                            $deputyName = explode(
                                                "@",
                                                $deputyName
                                            )[0];
                                        }
                                        $newManagers[] = [
                                            "empno" => $deputy["empno"],
                                            "name" => $deputyName,
                                            "full_name" =>
                                                $deputy["full_name"] ??
                                                $deputyName,
                                            "email" => $deputy["email"] ?? null,
                                            "dept_names" =>
                                                $manager["dept_names"] ?? [],
                                            "division_code" =>
                                                $manager["division_code"] ??
                                                null,
                                            "levels" =>
                                                $manager["levels"] ?? [],
                                            "deputies" => [],
                                            "status" => 1,
                                        ];
                                    }
                                }
                            }
                        }
                        $level["managers"] = $newManagers;
                    }
                }
            }

            return response()->json($flowData);
        } catch (\Exception $e) {
            return response()->json(
                ["success" => false, "error" => $e->getMessage()],
                500
            );
        }
    }
}
