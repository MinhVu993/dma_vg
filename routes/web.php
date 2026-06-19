<?php
header('Access-Control-Allow-Origin:  *');
header('Access-Control-Allow-Methods:  POST, GET');
header('Access-Control-Allow-Headers:  Content-Type, X-Auth-Token, Origin, Authorization,http_x_vg_authentication, anonymous');

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Services\EmailService;

// Add this in your service provider or bootstrap
app()->singleton(EmailService::class, function($app) {
    return new EmailService();
});

Route::prefix('vgDormTest')->group(function () {
  Route::post('savedb', 'vgDormTestCtrl@savedb');
  Route::get('getAllData', 'vgDormTestCtrl@getAllData');
  Route::post('acceptRequest', 'vgDormTestCtrl@acceptRequest');
  Route::post('denyRequest', 'vgDormTestCtrl@denyRequest');
  Route::get('getDormLoc', 'vgDormTestCtrl@getDormLoc');
  Route::get('getDormNation', 'vgDormTestCtrl@getDormNation');
  Route::post('updateRoom', 'vgDormTestCtrl@updateRoom');
  Route::post('updateQRCode', 'vgDormTestCtrl@updateQRCode');
  Route::get('getQRCode/{appname?}/{id?}', 'vgDormTestCtrl@getQRCode');
  Route::post('confirmAccept', 'vgDormTestCtrl@confirmAccept');
  Route::post('getAppFlow', 'vgDormTestCtrl@getAppFlow');
});
