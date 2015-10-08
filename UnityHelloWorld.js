var request = require('request');
var events = require('events');
var emitter = new events.EventEmitter();

// replace with your own appname, serviceusername, and servicepassword!
var ff = {
  "appname": '',
  "serviceusername": '',
  "servicepassword": ''
}

var Url = 'http://twlatestga.unitysandbox.com';
var Svc_username = ff.serviceusername;
var Svc_password = ff.servicepassword;
var Appname      = ff.appname;
var Ehr_username = 'jmedici';
var Ehr_password = 'password01';

// build Magic action JSON string
function buildJSON(action, appname, ehruserid, patientid, unitytoken,
              param1, param2, param3, param4, param5, param6, data) {
    return {'Action': action,
                       'Appname': appname,
                       'AppUserID': ehruserid,
                       'PatientID': patientid,
                       'Token': unitytoken,
                       'Parameter1': param1||'', 'Parameter2': param2||'', 'Parameter3': param3||'',
                       'Parameter4': param4||'', 'Parameter5': param5||'', 'Parameter6': param6||'',
                       'Data': data||''};
} // buildJSON

// post action JSON to MagicJson endpoint, get JSON in return
function unityAction(json, cb) {
    request.post({
		url: Url+'/Unity/UnityService.svc/json/MagicJson',
             	headers: {'Content-Type': 'application/json'},
             	body: JSON.stringify(json)
	}, function(err, res, body) {
		if (typeof cb=='function') cb(body);
	});
} // unityAction

// get Unity security token from GetToken endpoint
function unityToken(username, password, cb){
    request.post({
    		url: Url + '/Unity/UnityService.svc/json/GetToken',
		//url: dd.server,
             	headers: {'Content-Type': 'application/json'},
             	body: JSON.stringify({'Username': username, 'Password': password})
	}, function(err, res, body) {
		console.log('unityToken response: '+JSON.stringify(res));
		console.log('unityToken body: '+JSON.stringify(body));
		if (typeof cb=='function') cb(body);
	});
}

var token = false;

var getToken = function(){
	console.log('GetToken:');
	unityToken(Svc_username, Svc_password, function(body) {
		if (body.indexOf('Error')!=-1) {
			console.log('Failed getting token: ' + body);
			emitter.emit('CleanUp');
		}
		else {
			token = body;
			console.log('Using Unity security token: ' + token);
			emitter.emit('AuthEHR');
		}
	});
};

var authEHR = function(){
	console.log('AuthEHR:');
	var json = buildJSON('GetUserAuthentication', Appname, Ehr_username, '', token, Ehr_password);
	unityAction(json, function(body) {
		console.log('Output from GetUserAuthentication: ');
		console.log(body);
		var bodyJson = JSON.parse(body);
		var valid_user = bodyJson[0]['getuserauthenticationinfo'][0]['ValidUser'];
		if (valid_user == 'YES') {
			console.log('EHR user is valid.');
			emitter.emit('GetServerInfo');
		}
		else {
			console.log('EHR user is invalid: ' + body[0]['getuserauthenticationinfo'][0]['ErrorMessage']);
			emitter.emit('CleanUp');
		}

	});
};

var getServerInfo = function(){
	// Call GetServerInfo Magic action; patient ID, Parameter1-6, and data not used
	var json = buildJSON('GetServerInfo', Appname, Ehr_username, '', token);
	unityAction(json, function(body) {
		console.log('Output from GetServerInfo: ');
		console.log(body);
		emitter.emit('GetPatients');
	});
};

var getPatients = function(){
	console.log('GetPatients:');

	var stdin = process.openStdin();

	console.log('Enter a Patient ID to display (e.g., 324): ');
	stdin.addListener("data", function(d) {
    		// note:  d is an object, and when converted to a string it will
    		// end with a linefeed.  so we (rather crudely) account for that  
    		// with toString() and then substring() 
		var data=d.toString().trim();
    		console.log("you entered: [" + data + "]");

		if (!data) {
    			console.log('No patient ID specified; exiting.');
			emitter.emit('CleanUp');
		}
		else {
			// Call GetPatient Magic action; Parameter1-6 and data not used in this example
			var json = buildJSON('GetPatient', Appname, Ehr_username, data, token);
			unityAction(json, function(body) {
				console.log('Output from GetPatient: ');
				console.log(JSON.stringify(body));
				emitter.emit('CleanUp');
			});
		}
  	});

};

var cleanUp = function() {
	console.log('Clean Up.');
	process.exit(code=0);
};

emitter.on('GetToken', getToken);
emitter.on('AuthEHR', authEHR);
emitter.on('GetServerInfo', getServerInfo);
emitter.on('GetPatients', getPatients);
emitter.on('CleanUp', cleanUp);

emitter.emit('GetToken');  
