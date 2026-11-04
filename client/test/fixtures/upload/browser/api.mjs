import { createServer } from 'node:http';
const entries = new Map();
createServer(async (req,res)=>{
 const path = new URL(req.url ?? '/', 'http://localhost').pathname;
 res.setHeader('Content-Type','application/json');
 if(path==='/__test__/form' && req.method==='POST'){const chunks=[];for await(const c of req)chunks.push(Buffer.from(c));const e=JSON.parse(Buffer.concat(chunks));entries.set(String(e.id),{...e,requests:0});res.end('{}');return;}
 if(path==='/__test__/state'){res.end(JSON.stringify(Object.fromEntries(entries)));return;}
 const m=/^\/item-editing\/([^/]+)\/form$/.exec(path);
 if(m){const e=entries.get(m[1]);if(!e){res.statusCode=404;res.end('{"code":"NOT_FOUND"}');return;}e.requests++;if(e.disconnect){req.socket.destroy();return;}res.statusCode=e.status??200;res.end(e.raw??JSON.stringify(res.statusCode===200?e.form:{code:'TEST_ERROR'}));return;}
 if(/notification|user|categories|brands/.test(path)){res.end('{"category2":[],"brands":[],"count":0}');return;}
 res.statusCode=501;res.end('{"code":"UNEXPECTED_TEST_API"}');
}).listen(Number(process.env.UPLOAD_BROWSER_API_PORT??4041),'127.0.0.1');
