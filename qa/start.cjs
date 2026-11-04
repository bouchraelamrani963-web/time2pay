// Local-only QA launcher. Run only after separate QA startup approval.
// Reads reviewed configuration over stdin, never from inherited provider envs.
const {spawn}=require('node:child_process');
const {qaWebConfig}=require('./preflight.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const loaded={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/isolated-qa.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:loaded,exports:loaded.exports,Date,URL,Error});
const approved=process.argv.includes('--approved-local-qa');
if(!approved){console.error('Separate approval is required before starting the QA app.');process.exit(1)}
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{input+=chunk;if(input.length>65536)process.exit(1)});
process.stdin.on('end',async()=>{try{
 const env=JSON.parse(input);input='';loaded.exports.assertIsolatedQa(env,Date.now(),true);
 // The API key selects the actual Firebase signup project. Obtain authoritative
 // config for the fixed QA app instead of trusting a pasted or inherited key.
 const web=await qaWebConfig(env.TIME2PAY_QA_ACCESS_TOKEN);
 env.NEXT_PUBLIC_FIREBASE_API_KEY=web.apiKey;
 env.NEXT_PUBLIC_FIREBASE_PROJECT_ID=web.projectId;
 env.NEXT_PUBLIC_FIREBASE_APP_ID=web.appId;
 env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=web.authDomain;
 // No inherited .env/provider config; fail if any Next env file exists.
 for(const file of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local'])if(fs.existsSync(path.join(__dirname,'..',file)))throw Error('ENV_FILE_PRESENT');
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3015'],{cwd:path.join(__dirname,'..'),env:{PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,...env,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});
 child.on('exit',code=>{process.exitCode=code??1});
}catch{console.error('QA startup rejected; configuration and credentials were not logged.');process.exitCode=1}});
