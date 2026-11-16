'use strict';
// XMP-sidefil ved siden av bildet. Lightroom, Capture One og Photoshop leser den,
// så koden følger bildet selv om filen får nytt navn.

function esc(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

function sidecar(meta) {
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:sv="https://studiovest.no/ns/stasjon/1.0/">
   <dc:identifier>${esc(meta.code)}</dc:identifier>
   <dc:creator><rdf:Seq><rdf:li>Studiovest</rdf:li></rdf:Seq></dc:creator>
   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">© Studiovest</rdf:li></rdf:Alt></dc:rights>
   <xmp:CreateDate>${esc(meta.takenAt)}</xmp:CreateDate>
${meta.rating != null ? `   <xmp:Rating>${esc(meta.rating)}</xmp:Rating>\n` : ''}   <sv:Code>${esc(meta.code)}</sv:Code>
   <sv:Group>${esc(meta.group)}</sv:Group>
   <sv:Session>${esc(meta.session)}</sv:Session>
   <sv:Station>${esc(meta.station)}</sv:Station>
   <sv:Sequence>${esc(meta.seq)}</sv:Sequence>
   <sv:OriginalName>${esc(meta.original)}</sv:OriginalName>
   <sv:Sha256>${esc(meta.sha256)}</sv:Sha256>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
`;
}

module.exports = { sidecar };
