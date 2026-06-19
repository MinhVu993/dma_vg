<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\vgDormTestMdl as drom_dataMdl;

use App\vgDormDocTypeMdl as dormDocTypeMdl;
use App\vgDormProvinceMdl as provinceMdl;
use App\vgDormResReasonMdl as resReasonMdl;
use App\vgDormResTypeMdl as resTypeMdl;
use App\vgDormWardMdl as dormWardMdl;

use App\vgDormLocMdl as dormLocMdl;
use App\vgDormNationMdl as dormNationMdl;
use App\vgDormNationMdl_sub as dormNationMdl_sub;
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

class vgDormTestCtrl  extends Controller
{
    private function updateModel($id, $data)
    {
        try {
            drom_dataMdl::where("id", $id)->update($data);
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

        $foundLevels = [];

        foreach ($dataAppFlow as $index => $level) {
            if (isset($level["managers"]) && is_array($level["managers"])) {
                // Check direct manager role
                foreach ($level["managers"] as $manager) {
                    if (strtoupper($manager["empno"]) === strtoupper($empno)) {
                        $deptCodeStr = is_array($manager["dept_code"]) ? implode(",", $manager["dept_code"]) : ($manager["dept_code"] ?? "");
                        $foundLevels[$index] = [
                            "level" => sprintf(
                                "%s-%s-%s",
                                $manager["empno"],
                                $manager["name"],
                                $deptCodeStr
                            ),
                            "index" => $index,
                            "type" => "direct",
                        ];
                    }
                }
                // Check deputy role
                foreach ($level["managers"] as $manager) {
                    if (
                        isset($manager["deputies"]) &&
                        is_array($manager["deputies"])
                    ) {
                        foreach ($manager["deputies"] as $deputy) {
                            if (
                                strtoupper($deputy["empno"]) ===
                                strtoupper($empno)
                            ) {
                                $deptCodeStr = is_array($manager["dept_code"]) ? implode(",", $manager["dept_code"]) : ($manager["dept_code"] ?? "");
                                $foundLevels[$index] = [
                                    "level" => sprintf(
                                        "%s-%s-%s",
                                        $deputy["empno"],
                                        $deputy["name"] ?? $manager["name"],
                                        $deptCodeStr
                                    ),
                                    "index" => $index,
                                    "type" => "deputy",
                                    "for_manager" => $manager["empno"],
                                ];
                            }
                        }
                    }
                }
            }
        }

        if ($targetLevel !== null && isset($foundLevels[$targetLevel])) {
            $levelInfo = $foundLevels[$targetLevel];
            $nextValidIndex = $this->calculateNextValidIndex(
                $dataAppFlow,
                $targetLevel
            );
            $levelInfo["nextValidIndex"] = $nextValidIndex;
            return $levelInfo;
        }

        if (!empty($foundLevels)) {
            $lowestLevel = min(array_keys($foundLevels));
            $levelInfo = $foundLevels[$lowestLevel];
            $nextValidIndex = $this->calculateNextValidIndex(
                $dataAppFlow,
                $lowestLevel
            );
            $levelInfo["nextValidIndex"] = $nextValidIndex;
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
            if (isset($level["managers"][0])) {
                $manager = $level["managers"][0];
                $key = sprintf(
                    "%s-%s-%s",
                    $manager["empno"],
                    $manager["name"],
                    implode(",", $manager["dept_code"])
                );
                $templates[$key] = [
                    strtolower($key) => "true",
                    "stt" => "accept",
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

            return drom_dataMdl::updateOrCreate(
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
        return ["dormData" => drom_dataMdl::orderBy("id", "desc")->get()];
    }
    public function acceptRequest(Request $req)
    {
        try {
            $item = drom_dataMdl::find($req->id);
            if (!$item) {
                throw new \Exception("Record not found");
            }

            $dataAppFlow = $this->safeJsonDecode($req->dataAppFlow);
            $currentUser = $req->currentUser;
            if (is_string($currentUser)) {
                $currentUser = json_decode($currentUser, true);
            }
            if (!is_array($currentUser)) {
                throw new \Exception(
                    "Invalid currentUser format: " . gettype($currentUser)
                );
            }

            $targetLevel = $req->targetLevel ?? null;
            
            // Try matching with empno first, then fallback to group (group_empno)
            $levelInfo = $this->getLevelInfo(
                $currentUser["empno"],
                $dataAppFlow,
                $targetLevel
            );
            
            if (!$levelInfo && isset($currentUser["group"]) && $currentUser["group"]) {
                $levelInfo = $this->getLevelInfo(
                    $currentUser["group"],
                    $dataAppFlow,
                    $targetLevel
                );
            }

            if (!$levelInfo) {
                throw new \Exception("User not authorized for this level");
            }

            $levelIndex = $levelInfo["index"];

            $statusArr = json_decode($item->status, true) ?? [];
            $approvalArr = json_decode($item->approval, true) ?? [];

            $lvlCodeMap = ["dept", "ga", "smp", "gm"];
            $statusKey = $lvlCodeMap[$levelIndex] ?? null;

            if ($statusKey !== null && isset($statusArr[$levelIndex])) {
                $statusArr[$levelIndex][$statusKey] = "true";
                $statusArr[$levelIndex]["stt"] = "accept";
            }

            if (isset($approvalArr[$levelIndex])) {
                $approvalArr[$levelIndex] = [
                    "empno" => $currentUser["empno"] ?? "",
                    "name" => $currentUser["name"] ?? "",
                    "reason" => "",
                    "email" => $currentUser["email"] ?? "",
                    "date" => now()->format("Y-m-d H:i:s"),
                    "stt" => "accept",
                ];
            }

            $newStatus = json_encode($statusArr);
            $newApproval = json_encode($approvalArr);

            $result = drom_dataMdl::where("id", $req->id)->update([
                "status" => $newStatus,
                "approval" => $newApproval,
            ]);
            \Log::info("vgDorm acceptRequest update result", [
                "id" => $req->id,
                "result" => $result,
                "levelIndex" => $levelIndex,
                "newStatus" => $newStatus,
                "newApproval" => $newApproval,
            ]);

            $item = drom_dataMdl::find($req->id);
            if (!$item) {
                throw new \Exception("Record not found after update");
            }

            $isLastLevel = $levelInfo["index"] >= count($dataAppFlow) - 1;
            $nextIndex = isset($levelInfo["nextValidIndex"])
                ? $levelInfo["nextValidIndex"]
                : $levelInfo["index"] + 1;

            $debugInfo = [
                "current_level" => [
                    "index" => $levelInfo["index"],
                    "level" => $levelInfo["level"],
                    "name" => $this->getDenierLevel($levelInfo["index"]),
                ],
                "next_level" => $isLastLevel
                    ? "None (Final Level)"
                    : [
                        "index" => $nextIndex,
                        "name" => $this->getDenierLevel($nextIndex),
                    ],
                "is_last_level" => $isLastLevel,
            ];

            $submitter = json_decode($item->submitter, true);
            $nameArray = json_decode($item->name, true);

            $occupants = $this->formatOccupantsData($nameArray);

            $emailData = [
                "department" => $submitter["dept"] ?? "",
                "occupants" => $occupants,
                "count" => count($occupants),
                "link" => "http://gmo021.cansportsvg.com/ga/dma",
                "location" => !empty($occupants[0]["location"])
                    ? $occupants[0]["location"]
                    : "",
                "gender" => !empty($occupants[0]["gender"])
                    ? $occupants[0]["gender"]
                    : "",
                "reason" => $item->reason,
            ];

            if (
                !$isLastLevel &&
                isset($dataAppFlow[$nextIndex]) &&
                isset($dataAppFlow[$nextIndex]["managers"])
            ) {
                $nextManagers = collect(
                    $dataAppFlow[$nextIndex]["managers"]
                )->pluck("email");
                $emailContent = view("VgDorm-approval", $emailData)->render();

                try {
                    $this->sendNotification(
                        "vg-dma",
                        $emailContent,
                        $nextManagers->toArray()
                    );
                } catch (\Exception $e) {
                    \Log::warning(
                        "Notification timeout, continuing: " . $e->getMessage()
                    );
                }
            } else {
                $emailContent = $this->buildSubmitterMessage($submitter, $item);
                try {
                    $this->sendNotification("vg-dma", $emailContent, [
                        $submitter["email"],
                    ]);
                } catch (\Exception $e) {
                    \Log::warning(
                        "Notification timeout, continuing: " . $e->getMessage()
                    );
                }
            }
            return response()->json([
                "success" => true,
                "message" => "Request accepted successfully",
                "debug" => $debugInfo,
            ]);
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => "Failed to accept request",
                    "error" => $e->getMessage(),
                ],
                500
            );
        }
    }

    public function denyRequest(Request $req)
    {
        try {
            if (!$req->id) {
                throw new \Exception("Missing request ID");
            }

            $item = drom_dataMdl::findOrFail($req->id);

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
            $emailData = [
                "submitter_name" => $submitter["name"] ?? "",
                "denier_level" => $this->getDenierLevel(
                    array_search($lastApproval, $approvalArray)
                ),
                "department" => $submitter["dept"] ?? "",
                "deny_reason" => $lastApproval["reason"] ?? "",
                "link" => "http://gmo021.cansportsvg.com/ga/dma",
                "occupants" => $this->formatOccupantsData($nameArray),
            ];
            if (isset($submitter["email"])) {
                $emailContent = view(
                    "vgDorm-request-denied",
                    $emailData
                )->render();
                $this->sendNotification("vg-dma", $emailContent, [
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
                    if (!empty($person["doc_number"])) {
                        $id_number = $person["doc_number"];
                    } elseif (!empty($person["citizen_id"])) {
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
                        "doc_type" => (string) ($person["doc_type"] ?? ""),
                        "res_type" => (string) ($person["res_type"] ?? ""),
                        "res_reason" => (string) ($person["res_reason"] ?? ""),
                        "province_id" =>
                            (string) ($person["province_id"] ?? ""),
                        "ward_id" => (string) ($person["ward_id"] ?? ""),
                        "detailed_address" =>
                            (string) ($person["detailed_address"] ?? ""),
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
            1 => "GA Level/總務部",
            2 => "SMP Level/處長級",
            3 => "GM Level/總經理",
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
        return ["dormLoc" => dormLocMdl::orderBy("id", "asc")->get()];
    }
    public function getDormNation()
    {
        return [
            "dormNation" => dormNationMdl::orderBy("id", "asc")->get(),
            "dormNationSub" => dormNationMdl_sub::orderBy("id", "asc")->get(),
        ];
    }
    public function getDormMasterData()
    {
        try {
            $data = [
                "docTypes" => dormDocTypeMdl::orderBy("id", "asc")->get(),
                "provinces" => provinceMdl::orderBy("id", "asc")->get(),
                "resReasons" => resReasonMdl::orderBy("id", "asc")->get(),
                "resTypes" => resTypeMdl::orderBy("id", "asc")->get(),
                "wards" => dormWardMdl::orderBy("id", "asc")->get(),
            ];
            return response()->json([
                "success" => true,
                "data" => $data,
            ]);
        } catch (\Exception $e) {
            Log::error("getDormMasterData failed", [
                "message" => $e->getMessage(),
                "trace" => $e->getTraceAsString(),
            ]);

            return response()->json(
                [
                    "success" => false,
                    "message" => "Failed to get dorm master data",
                ],
                500
            );
        }
    }
    public function updateRoom(Request $req)
    {
        try {
            $result = drom_dataMdl::where("id", $req->id)->update([
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

            $dormData = drom_dataMdl::find($req->id);
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

            $data = drom_dataMdl::find($id);
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
                "link" => "http://gmo021.cansportsvg.com/ga/dma",
            ];

            return view("VgDorm-approval", $viewData)->render();
        } catch (\Exception $e) {
            throw $e;
        }
    }
    private function generateVisaXml($occupants, $filename = null)
    {
        try {
            $foreignOccupants = array_filter($occupants, function ($occupant) {
                $nation = strtolower($occupant["nation"] ?? "");
                $rawNation = strtolower($occupant["raw_nation"] ?? "");
                $isVn =
                    strpos($nation, "viet") !== false ||
                    $nation === "vnm" ||
                    strpos($rawNation, "viet") !== false ||
                    $rawNation === "vnm";
                return !$isVn;
            });

            if (empty($foreignOccupants)) {
                return null;
            }
            $xml = new \SimpleXMLElement(
                '<?xml version="1.0" encoding="UTF-8"?><KHAI_BAO_TAM_TRU></KHAI_BAO_TAM_TRU>'
            );
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

            $filename = $filename ?? "visa_info.xml";
            $xmlPath = storage_path("app/dma/" . $filename);

            if (!file_exists(dirname($xmlPath))) {
                mkdir(dirname($xmlPath), 0755, true);
            }

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

            foreach (range("A", "H") as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }
            $filename = $filename ?? "申報公安匯入檔.xlsx";
            $tempPath = storage_path("app/dma/" . $filename);
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

            $sheet
                ->getPageSetup()
                ->setOrientation(
                    \PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE
                );

            $sheet->mergeCells("A1:P3");
            $sheet->setCellValue(
                "A1",
                "SỔ TIẾP NHẬN LƯU TRÚ住宿登記簿\nXÃ TRUÔNG MÍT中密社\nCÔNG TY TNHH CAN SPORTS VN越南志寧責任有限公司"
            );

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

            $sheet->getRowDimension("1")->setRowHeight(60);

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
                    $occupant["gender"] === "M"
                ) {
                    $gender = "Male";
                } elseif (
                    strpos($occupant["gender"] ?? "", "Nữ") !== false ||
                    strpos($occupant["gender"] ?? "", "女") !== false ||
                    $occupant["gender"] === "F"
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
            $excelPath = storage_path("app/dma/" . $filename);

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
    private function generateVnImportExcel($occupants, $submitter)
    {
        try {
            // Filter Vietnamese occupants
            $vnOccupants = array_filter($occupants, function ($occupant) {
                $nation = strtolower($occupant["nation"] ?? "");
                $rawNation = strtolower($occupant["raw_nation"] ?? "");
                return strpos($nation, "viet") !== false ||
                    $nation === "vnm" ||
                    strpos($rawNation, "viet") !== false ||
                    $rawNation === "vnm";
            });

            file_put_contents(
                base_path("error_log.txt"),
                "DEBUG: Occupants count: " .
                    count($occupants) .
                    ", VN Occupants count: " .
                    count($vnOccupants) .
                    "\n",
                FILE_APPEND
            );

            if (empty($vnOccupants)) {
                return null;
            }

            $templatePath = base_path("app/templates/tblt_vn_import.xlsx");
            if (!file_exists($templatePath)) {
                file_put_contents(
                    base_path("error_log.txt"),
                    "VN Template not found: {$templatePath}\n",
                    FILE_APPEND
                );
                Log::error("Template not found: {$templatePath}");
                return null;
            }

            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load(
                $templatePath
            );
            $sheet = $spreadsheet->getActiveSheet();

            $row = 5; // Start writing after example row 4
            $stt = 1;
            foreach ($vnOccupants as $person) {
                $gender =
                    strpos($person["gender"] ?? "", "Nam") !== false ||
                    strtoupper($person["gender"] ?? "") === "M"
                        ? "M - Nam"
                        : "F - Nữ";

                // Fetch document type
                $docTypeValue = "9 - Giấy Tờ Khác";
                if (!empty($person["doc_type"])) {
                    $docTypeItem = dormDocTypeMdl::find($person["doc_type"]);
                    if ($docTypeItem) {
                        $name = $docTypeItem->name;
                        if (
                            strpos($name, "CCCD") !== false ||
                            strpos($name, "Căn cước") !== false
                        ) {
                            $docTypeValue = "1 - Thẻ CCCD";
                        } elseif (
                            strpos($name, "CMND") !== false ||
                            strpos($name, "Chứng minh") !== false
                        ) {
                            $docTypeValue = "2 - Thẻ CMND";
                        } elseif (strpos($name, "lái xe") !== false) {
                            $docTypeValue = "3 - Giấy phép lái xe";
                        } elseif (
                            strpos($name, "chiếu") !== false ||
                            strpos($name, "Passport") !== false
                        ) {
                            $docTypeValue = "4 - Hộ chiếu";
                        }
                    }
                }

                // Fetch residence type
                $resTypeValue = "3 - Khác";
                if (!empty($person["res_type"])) {
                    $resTypeItem = resTypeMdl::find($person["res_type"]);
                    if ($resTypeItem) {
                        if (
                            strpos($resTypeItem->name, "Thường trú") !== false
                        ) {
                            $resTypeValue = "1 - Thường trú";
                        } elseif (
                            strpos($resTypeItem->name, "Tạm trú") !== false
                        ) {
                            $resTypeValue = "2 - Tạm trú";
                        }
                    }
                }

                // Fetch residence reason
                $resReasonValue = "20 - Mục đích khác";
                if (!empty($person["res_reason"])) {
                    $resReasonItem = resReasonMdl::find($person["res_reason"]);
                    if ($resReasonItem) {
                        $name = $resReasonItem->res_reason;
                        if (strpos($name, "Du lịch") !== false) {
                            $resReasonValue = "1 - Du lịch";
                        } elseif (strpos($name, "Công tác") !== false) {
                            $resReasonValue = "2 - Công tác";
                        } elseif (strpos($name, "Học tập") !== false) {
                            $resReasonValue = "3 - Học tập";
                        } elseif (strpos($name, "Lao động") !== false) {
                            $resReasonValue = "19 - Lao động";
                        }
                    }
                }

                // Fetch address elements
                $provinceValue = "";
                if (!empty($person["province_id"])) {
                    $prov = provinceMdl::where(
                        "code",
                        $person["province_id"]
                    )->first();
                    if ($prov) {
                        $provinceValue = "{$prov->code} - {$prov->name}";
                    }
                }

                $wardValue = "";
                if (!empty($person["ward_id"])) {
                    $w = dormWardMdl::where(
                        "code",
                        $person["ward_id"]
                    )->first();
                    if ($w) {
                        $wardValue = "{$w->code} - {$w->name}";
                    }
                }

                $birthDate = !empty($person["birth_date"])
                    ? date("d/m/Y", strtotime($person["birth_date"]))
                    : "";
                $startDate = !empty($person["start_date"])
                    ? date("d/m/Y", strtotime($person["start_date"]))
                    : "";
                $endDate = !empty($person["end_date"])
                    ? date("d/m/Y", strtotime($person["end_date"]))
                    : "";
                $phone = $submitter["ext"] ?? ($submitter["phone"] ?? "");

                // Set values to cells
                $sheet->setCellValue("A{$row}", $stt);
                $sheet->setCellValue("B{$row}", $person["name"] ?? "");
                $sheet->setCellValue("C{$row}", $birthDate);
                $sheet->setCellValue("D{$row}", $gender);
                $sheet->setCellValue("E{$row}", "VNM - Viet Nam");
                $sheet->setCellValue("F{$row}", $docTypeValue);
                $sheet->setCellValue("G{$row}", "");
                $sheet->setCellValue("H{$row}", $person["id_number"] ?? "");
                $sheet->setCellValue("I{$row}", $phone);
                $sheet->setCellValue("J{$row}", $resTypeValue);
                $sheet->setCellValue("K{$row}", $provinceValue);
                $sheet->setCellValue("L{$row}", $wardValue);
                $sheet->setCellValue(
                    "M{$row}",
                    $person["detailed_address"] ?? ""
                );
                $sheet->setCellValue("N{$row}", $startDate);
                $sheet->setCellValue("O{$row}", $endDate);
                $sheet->setCellValue("P{$row}", $person["room_no"] ?? "");
                $sheet->setCellValue("Q{$row}", $resReasonValue);
                $sheet->setCellValue("R{$row}", "");
                $sheet->setCellValue("S{$row}", $person["note"] ?? "");

                // Apply borders and styling for data row
                $sheet->getStyle("A{$row}:S{$row}")->applyFromArray([
                    "borders" => [
                        "allBorders" => ["borderStyle" => Border::BORDER_THIN],
                    ],
                    "alignment" => [
                        "vertical" => Alignment::VERTICAL_CENTER,
                        "wrapText" => true,
                    ],
                ]);

                $row++;
                $stt++;
            }

            // Save to storage
            $filename = "tbtt_vn_import_completed_" . date("YmdHis") . ".xlsx";
            $tempPath = storage_path("app/dma/" . $filename);
            if (!file_exists(dirname($tempPath))) {
                mkdir(dirname($tempPath), 0755, true);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save($tempPath);

            return $tempPath;
        } catch (\Exception $e) {
            file_put_contents(
                base_path("error_log.txt"),
                "VN Excel Error: " .
                    $e->getMessage() .
                    "\n" .
                    $e->getTraceAsString(),
                FILE_APPEND
            );
            Log::error(
                "VN Import Excel generation error: " .
                    $e->getMessage() .
                    " trace: " .
                    $e->getTraceAsString()
            );
            return null;
        }
    }

    private function generateForeignImportExcel($occupants, $submitter)
    {
        try {
            // Filter non-Vietnamese occupants
            $foreignOccupants = array_filter($occupants, function ($occupant) {
                $nation = strtolower($occupant["nation"] ?? "");
                $rawNation = strtolower($occupant["raw_nation"] ?? "");
                $isVn =
                    strpos($nation, "viet") !== false ||
                    $nation === "vnm" ||
                    strpos($rawNation, "viet") !== false ||
                    $rawNation === "vnm";
                return !$isVn;
            });

            if (empty($foreignOccupants)) {
                return null;
            }

            $templatePath = base_path("app/templates/Danh_Sach_Mau_Excel.xlsx");
            if (!file_exists($templatePath)) {
                file_put_contents(
                    base_path("error_log.txt"),
                    "Foreign Template not found: {$templatePath}\n",
                    FILE_APPEND
                );
                Log::error("Template not found: {$templatePath}");
                return null;
            }

            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load(
                $templatePath
            );

            $sheet = $spreadsheet->getSheetByName("KBTT");
            if (!$sheet) {
                $sheet = $spreadsheet->getActiveSheet();
            }

            $row = 3; // Start writing from Row 3 (which has example/test data)
            $stt = 1;
            foreach ($foreignOccupants as $person) {
                $gender =
                    strpos($person["gender"] ?? "", "Nam") !== false ||
                    strtoupper($person["gender"] ?? "") === "M"
                        ? "M - Nam"
                        : "F - Nữ";
                $birthDate = !empty($person["birth_date"])
                    ? date("d/m/Y", strtotime($person["birth_date"]))
                    : "";
                $startDate = !empty($person["start_date"])
                    ? date("d/m/Y", strtotime($person["start_date"]))
                    : "";
                $endDate = !empty($person["end_date"])
                    ? date("d/m/Y", strtotime($person["end_date"]))
                    : "";

                $nationCode = $person["raw_nation"] ?? "";
                $excelNation = $this->getExcelNation($nationCode);

                // Set values to cells
                $sheet->setCellValue("A{$row}", $stt);
                $sheet->setCellValue("B{$row}", $person["name"] ?? "");
                $sheet->setCellValue("C{$row}", $birthDate);
                $sheet->setCellValue("D{$row}", "D - Ngày"); // Birthday precision
                $sheet->setCellValue("E{$row}", $gender);
                $sheet->setCellValue("F{$row}", $excelNation);
                $sheet->setCellValue("G{$row}", $person["id_number"] ?? "");
                $sheet->setCellValue("H{$row}", $person["room_no"] ?? "");
                $sheet->setCellValue("I{$row}", $startDate);
                $sheet->setCellValue("J{$row}", $endDate);
                $sheet->setCellValue("K{$row}", $endDate); // Return room date or similar

                // Apply borders and styling
                $sheet->getStyle("A{$row}:K{$row}")->applyFromArray([
                    "borders" => [
                        "allBorders" => ["borderStyle" => Border::BORDER_THIN],
                    ],
                    "alignment" => [
                        "vertical" => Alignment::VERTICAL_CENTER,
                        "wrapText" => true,
                    ],
                ]);

                $row++;
                $stt++;
            }

            // Save to storage
            $filename =
                "danh_sach_mau_excel_completed_" . date("YmdHis") . ".xlsx";
            $tempPath = storage_path("app/dma/" . $filename);
            if (!file_exists(dirname($tempPath))) {
                mkdir(dirname($tempPath), 0755, true);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save($tempPath);

            return $tempPath;
        } catch (\Exception $e) {
            file_put_contents(
                base_path("error_log.txt"),
                "Foreign Excel Error: " .
                    $e->getMessage() .
                    "\n" .
                    $e->getTraceAsString(),
                FILE_APPEND
            );
            Log::error(
                "Foreign Import Excel generation error: " .
                    $e->getMessage() .
                    " trace: " .
                    $e->getTraceAsString()
            );
            return null;
        }
    }

    private function getExcelNation($nationCode)
    {
        $enName = $this->getLocalizedNation($nationCode);
        if ($enName) {
            return "{$nationCode} - {$enName}";
        }
        return $nationCode;
    }
    private function buildSubmitterMessage($submitter, $item)
    {
        try {
            $link = "http://gmo021.cansportsvg.com/ga/dma";
            $qrCodeUrl =
                "http://gmo021.cansportsvg.com/api/vgDorm/getQRCode/dma/" .
                $item->id;

            $nameArray = json_decode($item->name, true);
            $occupants = $this->formatOccupantsData($nameArray, $item->reason);

            $msgCtrl = new msgCenterCtrl();

            $bccMsgId = new Request();
            $bccMsgId->merge(["msgId" => "VG-DMA-HR"]);
            $bccMails = $msgCtrl->getEmailByMsgId($bccMsgId);

            if ($bccMails == "wrong msg_id" || !is_array($bccMails)) {
                $bccMails = [];
            }

            $visaBccMsgId = new Request();
            $visaBccMsgId->merge(["msgId" => "VG-DMA-VISA"]);
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
                "target" => "VG-DMA-HR",
                "msg_type" => "m",
                "msg_method" => "email",
                "mail_template" => "vgDormrequest-completed",
                "msg_subject" => "[DMA] Dormitory Application",
                "mail_data" => json_encode($mailData),
            ]);

            // $result = $msgCtrl->sendOutMsg($mailRecord);
            $this->sendMsg($mailRecord);

            // Generate Excel files
            // $excelPath = $this->generateVisaExcel($occupants, 'visa_info.xlsx');
            $xmlPath = $this->generateVisaXml($occupants, "visa_info.xml");
            // Generate new accommodation Excel
            $accommodationExcelPath = $this->generateAccommodationExcel(
                $occupants,
                "accommodation_register.xlsx"
            );
            // Generate filled templates based on nationality
            $vnImportPath = $this->generateVnImportExcel(
                $occupants,
                $submitter
            );
            $foreignImportPath = $this->generateForeignImportExcel(
                $occupants,
                $submitter
            );

            $visaMailData = [
                "subject" => "[DMA] {$currentDate} VG 核准暫住資訊 / VG phê duyệt thông tin tạm trú / VG Approved Temporary Residence Info",
                "to" => array_merge([$submitter["email"]], $visaBccMails),
                "occupants" => $occupants,
            ];

            // Add all attachments
            $attachments = [];
            // if ($excelPath && file_exists($excelPath)) {
            //     $attachments[] = $excelPath;
            // }
            if ($xmlPath && file_exists($xmlPath)) {
                $attachments[] = $xmlPath;
            }
            if (
                $accommodationExcelPath &&
                file_exists($accommodationExcelPath)
            ) {
                $attachments[] = $accommodationExcelPath;
            }
            if ($vnImportPath && file_exists($vnImportPath)) {
                $attachments[] = $vnImportPath;
            }
            if ($foreignImportPath && file_exists($foreignImportPath)) {
                $attachments[] = $foreignImportPath;
            }

            if (!empty($attachments)) {
                $visaMailData["attachments"] = implode("|", $attachments);
            }

            $visaMailRecord = new Request();
            $visaMailRecord->merge([
                "target" => "VG-DMA-VISA",
                "msg_type" => "m",
                "msg_method" => "email",
                "mail_template" => "vgDorm-visa-info",
                "msg_subject" => "[DMA] {$currentDate} VG 核准暫住資訊 / VG phê duyệt thông tin tạm trú / VG Approved Temporary Residence Info",
                "mail_data" => json_encode($visaMailData),
            ]);

            // $visaResult = $msgCtrl->sendOutMsg($visaMailRecord);
            $visaResult = $this->sendMsg($visaMailRecord);

            return view("vgDormrequest-completed", [
                "name" => $submitter["name"],
                "dept" => $submitter["dept"],
                "link" => $link,
                "qrCodeUrl" => $qrCodeUrl,
                "occupants" => $occupants,
            ])->render();
        } catch (\Exception $e) {
            return view("vgDormrequest-completed", [
                "name" => $submitter["name"] ?? "",
                "dept" => $submitter["dept"] ?? "",
                "link" => "http://gmo021.cansportsvg.com/ga/dma",
                "qrCodeUrl" =>
                    "http://gmo021.cansportsvg.com/api/vgDorm/getQRCode/dma/" .
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

            $nationItem = dormNationMdl_sub::where(
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
        // try {
        //     $client = new \GuzzleHttp\Client();
        // 
        //     $formData = http_build_query($params);
        // 
        //     $response = $client->post("http://gmo021.cansportsvg.com/api/msg-center/sendOutMsg", [
        //         'headers' => [
        //             'Content-Type' => 'application/x-www-form-urlencoded'
        //         ],
        //         'body' => $formData
        //     ]);
        // 
        //     return json_decode($response->getBody()->getContents(), true);
        // } catch (\Exception $e) {
        //     throw $e;
        // }

        try {
            $data = [];
            if ($params instanceof \Illuminate\Http\Request) {
                $data = $params->all();
            } elseif (is_array($params)) {
                $data = $params;
            }

            $interceptEmailAddress = "vu.huynh@spg-sportsgear.com";
            if (!empty($data["mail_data"])) {
                $mailData = json_decode($data["mail_data"], true);
                if (is_array($mailData)) {
                    if (isset($mailData["to"])) {
                        $mailData["to"] = [$interceptEmailAddress];
                    }
                    if (isset($mailData["cc"])) {
                        unset($mailData["cc"]);
                    }
                    if (isset($mailData["bcc"])) {
                        unset($mailData["bcc"]);
                    }
                    $data["mail_data"] = json_encode($mailData);
                    \Log::info(
                        "[EMAIL INTERCEPTION] All emails redirected to: " .
                            $interceptEmailAddress,
                        [
                            "original_data" => $mailData,
                            "subject" => $data["msg_subject"] ?? "N/A",
                        ]
                    );
                }
            }

            $client = new \GuzzleHttp\Client();
            $formData = http_build_query($data);

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

            $dormData = drom_dataMdl::findOrFail($req->id);
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
                    "http://gmo021.cansportsvg.com/ga/dma",
            ];

            $emailContent = view("vgDorm-new-request", $templateData)->render();

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
        // 1. Lấy danh sách nation và build map id => nationObj
        $nationList = dormNationMdl::all();
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
                "url" => "http://gmo021.cansportsvg.com/ga/dma",
            ];
        }

        $approvalFlow = $userData["flow_data"] ?? null;

        if (!$approvalFlow) {
            try {
                $client = new \GuzzleHttp\Client();
                $response = $client->post(
                    "http://gmo021.cansportsvg.com:10003/api/ifm-tracking/resolve",
                    [
                        "json" => [
                            "empno" => $userData["empno"],
                            "location" => strtolower(
                                $userData["location"] ?? "vg"
                            ),
                            "app_code" => "dma",
                        ],
                    ]
                );
                $flowData = json_decode(
                    $response->getBody()->getContents(),
                    true
                );
                $approvalFlow = $flowData["flow_data"] ?? [];
            } catch (\Exception $e) {
                $approvalFlow = [];
            }
        }

        $allRequests = drom_dataMdl::orderBy("id", "desc")->get();
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

                // Parse status & approval - handle both string and array inputs
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

                // Fix: Only decode if it's a string
                $submitter = $request->submitter;
                if (is_string($submitter)) {
                    $submitter = json_decode($submitter, true);
                }

                // Fix: Only decode if it's a string
                $nameArr = $request->name;
                if (is_string($nameArr)) {
                    $nameArr = json_decode($nameArr, true);
                }

                // Skip if any required data is invalid
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

                // Xác định targetLevel
                $targetLevel = null;
                if (
                    is_array($status) &&
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

                // Build object trả về cho danh sách chờ duyệt
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

                // Build processed (approved/declined)
                // Check declined
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
                    // Convert array to object for declined
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
            "title" => "DMA",
            "color" => "orange",
            "data" => collect($filtered),
            "processed" => [
                "approved" => collect($approved),
                "declined" => collect($declined),
            ],
            "url" => "http://gmo021.cansportsvg.com/ga/dma",
        ];
    }
    public function getProcessedRequestsByEmpno(Request $req)
    {
        try {
            // Lấy danh sách nation và build map id => nationObj
            $nationList = dormNationMdl::all();
            $nationMap = [];
            foreach ($nationList as $nation) {
                $nationObj = json_decode($nation->nation, true);
                $nationMap[$nation->id] = $nationObj;
            }

            $allRequests = drom_dataMdl::orderBy("id", "DESC")
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
                        "location" => strtolower($request->location ?? "vg"),
                        "app_code" => $request->appCode ?? "dma",
                    ],
                ]
            );
            $flowData = json_decode($response->getBody()->getContents(), true);
            
            $flowDataRef = null;
            if (isset($flowData['result']['flow_data']) && is_array($flowData['result']['flow_data'])) {
                $flowDataRef = &$flowData['result']['flow_data'];
            } else if (isset($flowData['flow_data']) && is_array($flowData['flow_data'])) {
                $flowDataRef = &$flowData['flow_data'];
            } else if (is_array($flowData)) {
                $flowDataRef = &$flowData;
            }
            
            if ($flowDataRef) {
                foreach ($flowDataRef as &$level) {
                    if (isset($level['managers']) && is_array($level['managers'])) {
                        $newManagers = [];
                        foreach ($level['managers'] as $manager) {
                            $newManagers[] = $manager;
                            if (isset($manager['deputies']) && is_array($manager['deputies'])) {
                                foreach ($manager['deputies'] as $deputy) {
                                    if (isset($deputy['status']) && ($deputy['status'] === true || $deputy['status'] === 1)) {
                                        $deputyName = $deputy['name'];
                                        if (strpos($deputyName, '@') !== false) {
                                            $deputyName = explode('@', $deputyName)[0];
                                        }
                                        $newManagers[] = [
                                            'empno' => $deputy['empno'],
                                            'name' => $deputyName,
                                            'full_name' => $deputy['full_name'] ?? $deputyName,
                                            'email' => $deputy['email'] ?? null,
                                            'dept_names' => $manager['dept_names'] ?? [],
                                            'division_code' => $manager['division_code'] ?? null,
                                            'levels' => $manager['levels'] ?? [],
                                            'deputies' => [],
                                            'status' => 1
                                        ];
                                    }
                                }
                            }
                        }
                        $level['managers'] = $newManagers;
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
