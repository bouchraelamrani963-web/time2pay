// Read-only provider check. Caller supplies a short-lived QA service-account
// token on stdin, never as an argv value or a file. No PATCH or user creation.
const PROJECT='time2pay-isolated-qa-20261030';
async function preflight(accessToken, request=fetch) {
  if(typeof accessToken!=='string'||!accessToken)throw Error('QA_TOKEN_MISSING');
  const headers={Authorization:`Bearer ${accessToken}`,'X-Goog-User-Project':PROJECT};
  const response=await request(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`,{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('QA_CONFIG_READ_FAILED');
  const config=await response.json();
  if(config.name!==`projects/${PROJECT}/config`)throw Error('QA_PROJECT_MISMATCH');
  const totp=config.mfa?.providerConfigs?.find(p=>p.totpProviderConfig);
  const usersResponse=await request(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchGet?maxResults=2`,{headers,signal:AbortSignal.timeout(15000)});
  if(!usersResponse.ok)throw Error('QA_USERS_READ_FAILED');
  const users=await usersResponse.json();
  return {projectId:PROJECT,emailPasswordEnabled:config.signIn?.email?.enabled===true,
    totpEnabled:totp?.state==='ENABLED',adjacentIntervals:totp?.totpProviderConfig?.adjacentIntervals??null,
    userListEmpty:!users.users?.length&&!users.nextPageToken,
    externalConfigurationChanged:false};
}
module.exports={preflight};
if(require.main===module){let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{input+=chunk;if(input.length>32768)process.exit(1)});process.stdin.on('end',async()=>{try{const parsed=JSON.parse(input);input='';const result=await preflight(parsed.accessToken);delete parsed.accessToken;console.log(JSON.stringify(result));if(!result.emailPasswordEnabled||!result.totpEnabled||!result.userListEmpty)process.exitCode=2;}catch{console.error('QA preflight failed; no provider response or credential logged.');process.exitCode=1}});}
