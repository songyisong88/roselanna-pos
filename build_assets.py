import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools import subset
G='/usr/share/fonts/truetype/sand-box/google/'
OUT='/workspace/roselanna-pos/'
# ---- fonts subset -> woff
def sub(src,dst,unicodes):
    opts=subset.Options(); opts.flavor='woff'; opts.layout_features=['*']; opts.notdef_outline=True
    f=TTFont(src); s=subset.Subsetter(opts); s.populate(unicodes=unicodes); s.subset(f)
    f.flavor='woff'; f.save(dst)
uni=list(range(0x20,0x7F))+list(range(0x0E01,0x0E5C))+[0x0E3F,0xA0,0x2013,0x2014,0x2022,0x2026,0x2212,0xD7,0x2190,0x2192,0x2713,0x2605,0x25CF,0x200B]
for w in ['Regular','Medium','SemiBold','Bold']:
    sub(G+'Sarabun/Sarabun-%s.ttf'%w, OUT+'fonts/Sarabun-%s.woff'%w, uni)
# ---- wordmark paths from Cinzel
cin=TTFont(G+'Cinzel/Cinzel-VariableFont_wght.ttf')
cin=instancer.instantiateVariableFont(cin,{'wght':680})
gs=cin.getGlyphSet(); cmap=cin.getBestCmap(); upm=cin['head'].unitsPerEm
def text_path(txt,size,track,x0=None,cx=None,y=0):
    sc=size/upm; items=[]; x=0
    for ch in txt:
        gn=cmap[ord(ch)]; adv=cin['hmtx'][gn][0]
        items.append((gn,x)); x+=adv*sc+track
    width=x-track
    start=(cx-width/2) if cx is not None else x0
    d=''
    for gn,gx in items:
        pen=SVGPathPen(gs, ntos=lambda v:('%.2f'%v).rstrip('0').rstrip('.'))
        tp=TransformPen(pen,(sc,0,0,-sc,start+gx,y))
        gs[gn].draw(tp); d+=pen.getCommands()
    return d,width
GOLD_DEFS='''<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8BE4A"/><stop offset=".5" stop-color="#C99A1E"/><stop offset="1" stop-color="#A97E10"/></linearGradient>
<mask id="rib"><rect x="0" y="0" width="1100" height="700" fill="#fff"/><path d="M527 205 L527 305" stroke="#000" stroke-width="7" stroke-linecap="round"/><path d="M374 413 C 410 402 440 382 462 356" stroke="none" fill="none"/></mask></defs>'''
EMB='''<g fill="none" stroke="url(#g)" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
<path d="M530 68 C490 110 455 160 458 225 C462 275 500 305 540 325 C585 300 605 260 602 215 C598 155 570 110 530 68 Z"/>
<path d="M372 308 L372 238 L438 200"/><path d="M674 308 L674 238 L608 200"/>
<path d="M444 487 L515 556 L586 487"/>
<g id="lf"><path d="M295 440 C298 385 345 335 408 328 C440 325 464 318 478 304 C494 360 492 425 452 468 C410 496 338 484 295 440 Z"/></g>
<use href="#lf" transform="translate(1046 0) scale(-1 1)"/>
</g>
<g fill="url(#g)">
<path d="M525 128 C500 160 485 192 492 232 C497 258 515 272 527 288 C546 268 563 246 562 216 C561 180 545 155 525 128 Z" mask="url(#rib)"/>
<path d="M376 414 C412 402 446 378 468 346 C452 388 418 414 376 414 Z" id="bl"/>
<path d="M376 414 C412 402 446 378 468 346 C452 388 418 414 376 414 Z" transform="translate(1046 0) scale(-1 1)"/>
<circle cx="518" cy="347" r="16"/></g>'''
def write(name,vb,body,title):
    open(OUT+'assets/'+name,'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" role="img" aria-label="%s"><title>%s</title>%s%s</svg>'%(vb,title,title,GOLD_DEFS,body))
T='ROSELANNA — Thai Massage &amp; Wellness'
write('logo-emblem.svg','270 50 510 530',EMB,'ROSELANNA emblem')
def fit(txt,target,track_ratio):
    _,w=text_path(txt,100,100*track_ratio,x0=0); k=target/w
    return 100*k,100*k*track_ratio
sz1,tr1=fit('ROSELANNA',600,.09)
sz2,tr2=fit('THAI MASSAGE & WELLNESS',440,.10)
w1,_=text_path('ROSELANNA',sz1,tr1,cx=523,y=690)
w2,_=text_path('THAI MASSAGE & WELLNESS',sz2,tr2,cx=523,y=760)
word='<path fill="url(#g)" d="%s"/><path fill="url(#g)" d="%s"/><g stroke="#C99A1E" stroke-width="3"><path d="M228 744 H290"/><path d="M756 744 H818"/></g>'%(w1,w2)
write('logo-full.svg','200 50 646 740',EMB+word,T)
# horizontal
w1h,_=text_path('ROSELANNA',sz1,tr1,x0=0,y=0)
w2h,_=text_path('THAI MASSAGE & WELLNESS',sz2,tr2,x0=0,y=0)
horiz='<g transform="translate(-270 -50)">%s</g><g transform="translate(560 270)"><path fill="url(#g)" d="%s"/></g><g transform="translate(560 345)"><path fill="url(#g)" d="%s"/></g>'%(EMB,w1h,w2h)
write('logo-horizontal.svg','0 0 1180 540',horiz,T)
