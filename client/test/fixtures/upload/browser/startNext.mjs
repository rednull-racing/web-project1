import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=new URL('../../../../',import.meta.url);
const child=spawn(process.execPath,[fileURLToPath(new URL('node_modules/next/dist/bin/next',root)),'start','--hostname','127.0.0.1','--port',process.env.UPLOAD_BROWSER_NEXT_PORT??'3041'],{cwd:fileURLToPath(root),stdio:'inherit',env:{...process.env,API_URL:process.env.UPLOAD_BROWSER_API_URL??'http://127.0.0.1:4041',NEXTAUTH_SECRET:process.env.UPLOAD_TEST_SECRET??'upload-local-fixture-secret',NEXTAUTH_URL:process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:3041'}});
process.on('SIGTERM',()=>child.kill('SIGTERM'));process.on('SIGINT',()=>child.kill('SIGINT'));child.on('exit',code=>process.exit(code??1));
