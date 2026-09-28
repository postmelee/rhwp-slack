import zipfile,xml.etree.ElementTree as E,copy,re,random,zlib,struct,json,pathlib
src=zipfile.ZipFile('tests/fixtures/viewer-two-pages.hwpx')
xml=src.read('Contents/section0.xml').decode()
for prefix,uri in re.findall(r'xmlns:(\w+)="([^"]+)"',xml): E.register_namespace(prefix,uri)
root=E.fromstring(xml)
hp='{http://www.hancom.co.kr/hwpml/2011/paragraph}'
def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
n=600
rng=random.Random(28)
raw=b''.join(b'\0'+rng.randbytes(n*3) for _ in range(n))
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',n,n,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
for count in (2,80):
 s=E.Element(root.tag,root.attrib)
 first=copy.deepcopy(root[0]);s.append(first)
 for i in range(count):
  p=copy.deepcopy(root[-1]);p.set('id',str(100+i));p.set('pageBreak','0' if i==0 else '1')
  for pic in p.iter(hp+'pic'):pic.set('id',str(100+i));pic.set('instid',str(100+i))
  for t in p.iter(hp+'t'):t.text='Synthetic shared image page '+str(i+1)
  for ls in p.findall(hp+'linesegarray'):p.remove(ls)
  s.append(p)
 dest=pathlib.Path(f'diagnostics/shared-image-{count}.hwpx')
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as out:
  for name in src.namelist():
   if name=='META-INF/rhwp-hwp5-origin':continue
   data=src.read(name)
   if name=='Contents/section0.xml':data=E.tostring(s,encoding='utf-8',xml_declaration=True)
   if name=='BinData/image1.png':data=png
   out.writestr(name,data)
 print(json.dumps({'file':str(dest),'bytes':dest.stat().st_size,'imageBytes':len(png)}))
