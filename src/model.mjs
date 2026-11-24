export const frameworks = Object.freeze({ kernelsu: 'https://github.com/tiann/KernelSU', next: 'https://github.com/KernelSU-Next/KernelSU-Next' });
export function validate(c) {
 const errors=[];
 if(!Object.hasOwn(frameworks,c.framework)) errors.push('Select a supported framework.');
 if(typeof c.name!=='string'||!c.name.trim()||c.name.length>60) errors.push('Name must contain 1–60 characters.');
 if(typeof c.package!=='string'||!(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/).test(c.package)) errors.push('Enter a valid Android application ID.');
 if(!/^[a-f0-9]{40}$/i.test(c.commit||'')) errors.push('Enter a reviewed 40-character upstream commit SHA.');
 return errors;
}
export function manifest(c) {
 const errors=validate(c); if(errors.length) throw new Error(errors.join(' '));
 return {schema:1,framework:c.framework,source:frameworks[c.framework],commit:c.commit.toLowerCase(),name:c.name.trim(),package:c.package,logo:c.logo||null,delivery:'manager-apk',status:'configuration-only',requirements:['Compatible installed engine','Supported manager authorization','Physical-device verification'],verified:{apk:false,engine:false,root:false}};
}
export function terminalCommand(input,c) {
 switch(input.trim().toLowerCase()){
 case 'help':return ['help · check · plan · status · releases · clear','Commands are workspace actions, not shell execution.'];
 case 'check': {const e=validate(c);return e.length?e:['Configuration valid. No APK or device tests have run.'];}
 case 'plan':return ['1. Review pinned source and licensing.','2. Apply supported branding and signing configuration.','3. Build using reviewed upstream workflow.','4. Verify APK and compatible installed engine on authorized device.'];
 case 'status':return ['Workspace ready. Build worker not connected.','APK: unbuilt | Engine: unverified | Root: unverified'];
 default:return ['Unknown command. Type help.'];
 }
}