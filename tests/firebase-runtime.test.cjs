const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
test('Firebase Admin and JWKS token verification work without experimental require(ESM)',()=>{
 const script=`
 const assert=require('node:assert/strict');
 const {generateKeyPairSync}=require('node:crypto');
 assert.equal(typeof require('firebase-admin/auth').getAuth,'function');
 const jwks=require('jwks-rsa'),jwt=require('jsonwebtoken');
 const pair=generateKeyPairSync('rsa',{modulusLength:2048});
 const key={...pair.publicKey.export({format:'jwk'}),kid:'synthetic-test',use:'sig',alg:'RS256'};
 const client=jwks({jwksUri:'https://invalid.example/unused',getKeysInterceptor:async()=>[key]});
 (async()=>{
 const signingKey=await client.getSigningKey('synthetic-test');
 const signed=jwt.sign({sub:'synthetic-user'},pair.privateKey,{algorithm:'RS256',keyid:key.kid});
 assert.equal(jwt.verify(signed,signingKey.getPublicKey(),{algorithms:['RS256']}).sub,'synthetic-user');
 const other=generateKeyPairSync('rsa',{modulusLength:2048});
 assert.throws(()=>jwt.verify(jwt.sign({sub:'forged'},other.privateKey,{algorithm:'RS256'}),signingKey.getPublicKey(),{algorithms:['RS256']}));
 })().catch(()=>{process.exitCode=1;});`;
 const r=spawnSync(process.execPath,['--no-experimental-require-module','-e',script],{encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,r.stderr);
});
