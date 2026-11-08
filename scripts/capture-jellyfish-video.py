from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
class Handler(SimpleHTTPRequestHandler):
 def do_POST(self):
  if self.path!='/capture':self.send_error(404);return
  output=Path('assets/video/jellyfish-loop.webm');output.parent.mkdir(parents=True,exist_ok=True)
  output.write_bytes(self.rfile.read(int(self.headers['Content-Length'])))
  self.send_response(200);self.end_headers();self.wfile.write(b'saved')
ThreadingHTTPServer(('127.0.0.1',8003),Handler).serve_forever()
