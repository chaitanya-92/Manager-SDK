import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,chmod,readdir,copyFile,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {validate,frameworks} from '../src/model.mjs';
export const home=resolve(process.env.MANAGER_SDK_HOME||join(homedir(),'.manager-sdk'));
const branches={kernelsu:'main',next:'dev'};
export function validateBuild(c){
 const errors=validate(c);
 if(c.framework==='next'&&c.package!=='com.rifsxd.ksunext')errors.push('KernelSU Next requires its upstream application ID in this adapter.');
 if(!/^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,47}$/.test(c.name||''))errors.push('Build names must use 1–48 letters, numbers, spaces, dots, underscores or hyphens.');
 if(c.logo&&(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(c.logo)||c.logo.length>700000))errors.push('Logo must be a PNG up to 512 KiB.');
 return errors;
}
export function signingId(c){return createHash('sha256').update(c.framework+'\0'+c.package).digest('hex').slice(0,32);}
export function diagnose(log){
 const rules=[[/SDK location not found|ANDROID_HOME|Android SDK not found/i,'Configure ANDROID_HOME and install the required SDK packages.'],[/NDK.*(not found|missing)|No version of NDK/i,'Install the NDK required by the pinned upstream revision.'],[/docker daemon|Cannot connect to the Docker/i,'Start Docker before using the KernelSU Next cross build.'],[/Unsupported class file|JAVA_HOME|Java 21/i,'Use JDK 21 and verify JAVA_HOME.'],[/Could not resolve|timed out|Connection reset/i,'Check network and dependency availability; retry the same pinned revision.'],[/signing|keystore/i,'Check the local signing identity and Android build tools; do not replace existing keys.']];
 return rules.filter(([r])=>r.test(log)).map(([,m])=>m);
}
export function run(cmd,args,{cwd,env={},log=()=>{},secrets=[],capture=false}={}){
 return new Promise((resolve,reject)=>{
  const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let out='',err='';
  const redact=s=>secrets.reduce((v,x)=>x?v.split(x).join('[REDACTED]'):v,s);
  p.stdout.on('data',b=>{out=(out+b).slice(-100000);if(!capture)log(redact(String(b)));});
  p.stderr.on('data',b=>{err=(err+b).slice(-100000);if(!capture)log(redact(String(b)));});
  p.on('error',e=>reject(new Error(cmd+': '+e.message)));
  p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(cmd+' failed ('+code+'): '+redact(err.slice(-1500)))));
 });
}
async function exists(p){try{return (await stat(p)).isFile();}catch{return false;}}
export async function build(c,id,log){
 const errors=validateBuild(c);if(errors.length)throw new Error(errors.join(' '));
 if(process.platform!=='linux'||process.arch!=='x64')throw new Error('Native build worker requires x86_64 Linux. Use a dedicated Linux machine or VM.');
 const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
 const ndk=process.env.ANDROID_NDK_HOME||process.env.ANDROID_NDK_ROOT;
 if(!sdk||!ndk)throw new Error('Configure ANDROID_HOME and ANDROID_NDK_HOME first.');
 if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid job ID');
 const work=join(home,'jobs',id),up=join(work,'upstream'),keys=join(home,'keys',signingId(c));
 await mkdir(work,{recursive:true,mode:0o700});await mkdir(keys,{recursive:true,mode:0o700});await chmod(keys,0o700);
 const opts={log};const source=frameworks[c.framework],branch=branches[c.framework];
 if(c.fork===true){log('Preparing GitHub fork (unmodified upstream; no client data pushed).');await run('gh',['repo','fork',source,'--clone=false','--remote=false'],opts);}
 log('Cloning pinned upstream source');await run('git',['clone','--branch',branch,'--no-single-branch',source+'.git',up],opts);
 await run('git',['checkout','--detach',c.commit],{...opts,cwd:up});
 await run('git',['merge-base','--is-ancestor',c.commit,'origin/'+branch],{...opts,cwd:up});
 await run('git',['submodule','update','--init','--recursive'],{...opts,cwd:up});
 if(c.logo){const p=join(work,'logo.png');await writeFile(p,Buffer.from(c.logo.split(',')[1],'base64'));await run('python3',[new URL('./patch-logo.py',import.meta.url).pathname,p,up],opts);}
 if(c.framework==='next')await run('python3',[new URL('./patch-next-name.py',import.meta.url).pathname],{...opts,cwd:work,env:{ROOTLAB_APP_NAME:c.name}});
 const key=join(keys,'client.p12'),passwordFile=join(keys,'password'),alias='manager';
 const haveKey=await exists(key),havePass=await exists(passwordFile);
 if(haveKey!==havePass)throw new Error('Incomplete signing identity: restore backup rather than generating a replacement.');
 if(!haveKey){const pass=randomBytes(32).toString('hex');await writeFile(passwordFile,pass,{mode:0o600,flag:'wx'});await run('keytool',['-genkeypair','-alias',alias,'-keyalg','RSA','-keysize','2048','-validity','10000','-storetype','PKCS12','-dname','CN=Manager SDK client','-keystore',key,'-storepass:env','MSDK_PASS','-keypass:env','MSDK_PASS'],{...opts,env:{MSDK_PASS:pass},secrets:[pass]});await chmod(key,0o600);}
 const pass=(await readFile(passwordFile,'utf8')).trim();
 const env={ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,ANDROID_NDK_HOME:ndk,ANDROID_NDK_ROOT:ndk};
 log('Compiling upstream native userspace components');
 await run('bash',[new URL('./native.sh',import.meta.url).pathname,c.framework],{...opts,cwd:up,env});
 // Upstream build scripts never receive the persistent client signing key.
 const manager=join(up,'manager'),temp=join(work,'temporary.p12'),tempPass=randomBytes(24).toString('hex');
 await run('keytool',['-genkeypair','-alias','temp','-keyalg','RSA','-keysize','2048','-validity','30','-storetype','PKCS12','-dname','CN=Temporary build','-keystore',temp,'-storepass:env','MSDK_PASS','-keypass:env','MSDK_PASS'],{...opts,env:{MSDK_PASS:tempPass},secrets:[tempPass]});
 log('Compiling manager APK');
 await run('bash',['gradlew','assembleRelease'],{...opts,cwd:manager,env:{...env,ORG_GRADLE_PROJECT_KEYSTORE_FILE:temp,ORG_GRADLE_PROJECT_KEY_ALIAS:'temp',ORG_GRADLE_PROJECT_KEYSTORE_PASSWORD:tempPass,ORG_GRADLE_PROJECT_KEY_PASSWORD:tempPass,ORG_GRADLE_PROJECT_KSU_NAME:c.name,ORG_GRADLE_PROJECT_KSU_PACKAGE_NAME:c.package},secrets:[tempPass]});
 let dir=join(manager,'app/build/outputs/apk/release');
 if(c.framework==='kernelsu'){await run('python3',['repack_apk.py','repack','-b','release','-t','release','-a','arm64-v8a','-a','x86_64','-K',temp,'-A','temp','-P',tempPass,'-S',tempPass,'--strip'],{...opts,cwd:up,env,secrets:[tempPass]});dir=join(up,'dist');}
 const apks=(await readdir(dir)).filter(n=>n.endsWith('.apk'));if(apks.length!==1)throw new Error('Expected exactly one APK, found '+apks.length);
 const tools=join(sdk,'build-tools');const versions=(await readdir(tools)).filter(v=>/^\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
 if(!versions.length)throw new Error('Install Android SDK build-tools.');
 const signer=join(tools,versions[0],'apksigner'),aapt=join(tools,versions[0],'aapt');
 const output=join(work,'Manager.apk');log('Signing with persistent local client identity');
 await run(signer,['sign','--ks',key,'--ks-key-alias',alias,'--ks-pass','env:MSDK_PASS','--key-pass','env:MSDK_PASS','--out',output,join(dir,apks[0])],{...opts,env:{MSDK_PASS:pass},secrets:[pass]});
 const cert=await run(signer,['verify','--verbose','--print-certs',output],{capture:true});
 const badging=await run(aapt,['dump','badging',output],{capture:true});
 if(!badging.includes("package: name='"+c.package+"'"))throw new Error('Final APK package does not match requested package.');
 if(!badging.includes("application-label:'"+c.name+"'"))throw new Error('Final APK label does not match requested name.');
 const sha256=createHash('sha256').update(await readFile(output)).digest('hex');
 const report={framework:c.framework,source,commit:c.commit,name:c.name,package:c.package,sha256,certificate:cert.split('\n').filter(x=>x.includes('SHA-256')),apkVerified:true,engineAuthorized:false,rootVerified:false,notes:'APK verification only. Compatible installed engine and supported authorization required. No device tests performed.'};
 await writeFile(join(work,'report.json'),JSON.stringify(report,null,2),{mode:0o600});log('APK signature and package verified. Engine and root remain unverified.');return report;
}