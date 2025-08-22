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

Route::prefix('vgDorm')->group(function () {
  Route::post('savedb', 'vgDormCtrl@savedb');
  Route::get('getAllData', 'vgDormCtrl@getAllData');
  Route::post('acceptRequest', 'vgDormCtrl@acceptRequest');
  Route::post('denyRequest', 'vgDormCtrl@denyRequest');
  Route::get('getDormLoc', 'vgDormCtrl@getDormLoc');
  Route::get('getDormNation', 'vgDormCtrl@getDormNation');
  Route::post('updateRoom', 'vgDormCtrl@updateRoom');
  Route::post('updateQRCode', 'vgDormCtrl@updateQRCode');
  Route::get('getQRCode/{appname?}/{id?}', 'vgDormCtrl@getQRCode');
  // Add new route for confirmAccept
  Route::post('confirmAccept', 'vgDormCtrl@confirmAccept');
});
