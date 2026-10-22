/** OMGIIT Exam Portal - Google Apps Script backend starter
 * Data is stored in a Google Spreadsheet in the owner's Drive.
 * IMPORTANT: Set ADMIN_USERNAME and ADMIN_PASSWORD in Script Properties before deployment.
 */
const APP_NAME = 'OMGIIT Student Exam Portal';
const SHEETS = { students: 'Students', assignments: 'Assignments', settings: 'Settings', results: 'Results' };

function setupOmgIitBackend() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('DATA_SPREADSHEET_ID');
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create(APP_NAME + ' Data');
    id = ss.getId();
    props.setProperty('DATA_SPREADSHEET_ID', id);
    const file = DriveApp.getFileById(id);
    const folderName = 'OMGIIT Exam Portal Data';
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    folder.addFile(file);
    try { DriveApp.getRootFolder().removeFile(file); } catch (e) {}
  }
  Object.keys(SHEETS).forEach(k => {
    let sh = ss.getSheetByName(SHEETS[k]);
    if (!sh) sh = ss.insertSheet(SHEETS[k]);
    if (sh.getLastRow() === 0) {
      const headers = {
        students: ['id','name','username','passwordHash','salt','course','setLimit','attemptLimit','status','assignmentAccess','createdAt'],
        assignments: ['id','title','course','due','description','createdAt'],
        settings: ['key','value'],
        results: ['id','studentId','studentName','course','set','correct','total','answered','percent','date','detailsJson']
      }[k];
      sh.appendRow(headers);
    }
  });
  if (!props.getProperty('ADMIN_USERNAME')) props.setProperty('ADMIN_USERNAME', 'admin');
  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', 'CHANGE-THIS-PASSWORD-NOW');
  return { ok: true, spreadsheetUrl: ss.getUrl(), message: 'Setup complete. Change ADMIN_PASSWORD in Script Properties before deployment.' };
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'ping') return json_({ ok: true, app: APP_NAME, message: 'Backend is running' });
  // Read-only JSONP support for simple health/config checks. Do not expose student records here.
  const callback = e && e.parameter && e.parameter.callback;
  const out = json_({ ok: false, error: 'Use POST for authenticated actions.' });
  if (callback && /^[A-Za-z_$][\w$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({ok:true, app:APP_NAME}) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return out;
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const req = JSON.parse(raw);
    const action = String(req.action || '');
    if (action === 'adminLogin') {
      const p = PropertiesService.getScriptProperties();
      if (String(req.username || '') !== p.getProperty('ADMIN_USERNAME') || String(req.password || '') !== p.getProperty('ADMIN_PASSWORD')) return json_({ok:false,error:'Invalid admin credentials'});
      const token = Utilities.getUuid() + Utilities.getUuid();
      CacheService.getScriptCache().put('admin:' + token, '1', 21600);
      return json_({ok:true,token:token});
    }
    if (!isAdmin_(req.token)) return json_({ok:false,error:'Admin session expired or unauthorized'});
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('DATA_SPREADSHEET_ID'));
    let result;
    switch (action) {
      case 'list': result = listData_(ss); break;
      case 'saveStudent': result = saveStudent_(ss, req.student || {}); break;
      case 'deleteStudent': result = deleteById_(ss.getSheetByName(SHEETS.students), req.id); break;
      case 'saveAssignment': result = saveAssignment_(ss, req.assignment || {}); break;
      case 'deleteAssignment': result = deleteById_(ss.getSheetByName(SHEETS.assignments), req.id); break;
      case 'saveSettings': result = saveSettings_(ss, req.settings || {}); break;
      case 'saveResult': result = saveResult_(ss, req.result || {}); break;
      case 'deleteResult': result = deleteById_(ss.getSheetByName(SHEETS.results), req.id); break;
      case 'deleteAllData': result = deleteAllData_(ss, req.confirmation); break;
      case 'logout': CacheService.getScriptCache().remove('admin:' + req.token); result = {ok:true}; break;
      default: return json_({ok:false,error:'Unknown action'});
    }
    return json_(result);
  } catch (err) {
    return json_({ok:false,error:String(err && err.message || err)});
  }
}

function isAdmin_(token) { return !!token && CacheService.getScriptCache().get('admin:' + token) === '1'; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function sheetRows_(sh) { const v=sh.getDataRange().getValues(); if(v.length<2)return []; const h=v[0].map(String); return v.slice(1).filter(r=>r.some(x=>x!=='' && x!==null)).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o;}); }
function listData_(ss) {
  const students=sheetRows_(ss.getSheetByName(SHEETS.students)).map(s=>{delete s.passwordHash;delete s.salt;return s;});
  const assignments=sheetRows_(ss.getSheetByName(SHEETS.assignments));
  const settings={}; sheetRows_(ss.getSheetByName(SHEETS.settings)).forEach(r=>{try{settings[r.key]=JSON.parse(r.value)}catch(e){settings[r.key]=r.value}});
  const results=sheetRows_(ss.getSheetByName(SHEETS.results)).map(r=>{try{r.details=JSON.parse(r.detailsJson||'null')}catch(e){} delete r.detailsJson;return r;});
  return {ok:true,students,assignments,settings,results};
}
function hash_(password,salt) { const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password, Utilities.Charset.UTF_8); return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join(''); }
function saveStudent_(ss,s) {
  if(!s.name||!s.username||!s.course)throw new Error('Name, username and course are required');
  const sh=ss.getSheetByName(SHEETS.students), rows=sheetRows_(sh); const id=String(s.id||Utilities.getUuid());
  if(rows.some(r=>String(r.username).toLowerCase()===String(s.username).toLowerCase()&&String(r.id)!==id))throw new Error('Username already exists');
  const old=rows.find(r=>String(r.id)===id); let salt=old?String(old.salt):Utilities.getUuid(); let ph=old?String(old.passwordHash):'';
  if(s.password){salt=Utilities.getUuid();ph=hash_(String(s.password),salt);} else if(!old)throw new Error('Password is required for a new student');
  const obj={id,name:String(s.name),username:String(s.username),passwordHash:ph,salt,course:String(s.course),setLimit:Number(s.setLimit||20),attemptLimit:Number(s.attemptLimit||3),status:String(s.status||'active'),assignmentAccess:String(s.assignmentAccess||'enabled'),createdAt:old?old.createdAt:new Date().toISOString()};
  upsert_(sh,'id',id,obj); return {ok:true,id:id};
}
function saveAssignment_(ss,a) { if(!a.title||!a.course)throw new Error('Title and course are required'); const id=String(a.id||Utilities.getUuid()); const obj={id,title:String(a.title),course:String(a.course),due:String(a.due||''),description:String(a.description||''),createdAt:new Date().toISOString()}; upsert_(ss.getSheetByName(SHEETS.assignments),'id',id,obj);return {ok:true,id:id}; }
function saveSettings_(ss,settings) { const sh=ss.getSheetByName(SHEETS.settings); Object.keys(settings).forEach(k=>{const val=JSON.stringify(settings[k]);const rows=sheetRows_(sh);const old=rows.find(r=>String(r.key)===k);if(old){const row=rows.findIndex(r=>String(r.key)===k)+2;sh.getRange(row,2).setValue(val)}else sh.appendRow([k,val]);});return {ok:true}; }
function saveResult_(ss,r) { const id=String(r.id||Utilities.getUuid());const obj={id,studentId:String(r.studentId||''),studentName:String(r.studentName||''),course:String(r.course||''),set:Number(r.set||1),correct:Number(r.correct||0),total:Number(r.total||0),answered:Number(r.answered||0),percent:Number(r.percent||0),date:String(r.date||new Date().toISOString()),detailsJson:JSON.stringify(r.details||{})};upsert_(ss.getSheetByName(SHEETS.results),'id',id,obj);return {ok:true,id:id}; }
function upsert_(sh,key,id,obj) { const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);const rows=sheetRows_(sh);const idx=rows.findIndex(r=>String(r[key])===String(id));const vals=headers.map(h=>obj[h]===undefined?'':obj[h]);if(idx>=0)sh.getRange(idx+2,1,1,headers.length).setValues([vals]);else sh.appendRow(vals); }
function deleteById_(sh,id) { if(!id)throw new Error('Record ID required');const rows=sheetRows_(sh);const idx=rows.findIndex(r=>String(r.id)===String(id));if(idx<0)return {ok:false,error:'Record not found'};sh.deleteRow(idx+2);return {ok:true}; }
function deleteAllData_(ss,confirmation) { if(confirmation!=='DELETE ALL OMGIIT DATA')throw new Error('Confirmation text did not match');Object.keys(SHEETS).forEach(k=>{const sh=ss.getSheetByName(SHEETS[k]);if(sh.getLastRow()>1)sh.deleteRows(2,sh.getLastRow()-1);});return {ok:true,message:'All student, assignment, settings and result records were deleted. Sheet headers were kept.'}; }
