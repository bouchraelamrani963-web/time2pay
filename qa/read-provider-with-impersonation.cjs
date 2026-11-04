// Operator-run only after separate approval for temporary QA server access.
// Does not change Firebase config, deploy an app, or create a user.
const {spawnSync}=require('node:child_process');
const {preflight}=require('./preflight.cjs');
const serviceAccount='firebase-adminsdk-fbsvc@time2pay-isolated-qa-20261030.iam.gserviceaccount.com';
async function main(){
 if(!process.argv.includes('--approved-keyless-access'))throw Error('APPROVAL_REQUIRED');
 const cli=spawnSync(process.platform==='win32'?'gcloud.cmd':'gcloud',['auth','print-access-token'],{encoding:'utf8',timeout:15000,windowsHide:true});
 if(cli.status!==0||!cli.stdout.trim())throw Error('CALLER_AUTH_REQUIRED');
 const response=await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,{
  method:'POST',headers:{Authorization:`Bearer ${cli.stdout.trim()}`,'Content-Type':'application/json'},
  body:JSON.stringify({scope:['https://www.googleapis.com/auth/cloud-platform'],lifetime:'3600s'}),signal:AbortSignal.timeout(15000)});
 cli.stdout='';
 if(!response.ok)throw Error('QA_IMPERSONATION_NOT_AVAILABLE');
 const token=await response.json();
 if(!token.accessToken||!token.expireTime)throw Error('QA_IMPERSONATION_RESPONSE_INVALID');
 const result=await preflight(token.accessToken);delete token.accessToken;
 console.log(JSON.stringify(result));
 if(!result.emailPasswordEnabled||!result.totpEnabled||!result.userListEmpty)process.exitCode=2;
}
if(require.main===module)main().catch(()=>{console.error('Keyless QA preflight did not complete; no tokens or provider responses logged. No fallback to private keys.');process.exitCode=1});
