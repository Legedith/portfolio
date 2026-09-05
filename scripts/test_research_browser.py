#!/usr/bin/env python3
"""Offline browser regression suite. Uses Chromium, not a live deployment.
The three real JS modules are combined into one inline module to avoid network
access. Static checks validate their original import paths separately.
"""
import argparse
import json
import math
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def document():
    html=(ROOT/'index.html').read_text()
    html=html.replace('<link rel="stylesheet" href="assets/research.css">','<style>'+(ROOT/'assets/research.css').read_text()+'</style>')
    source='\n'.join(re.sub(r'^import .*?;\n','',(ROOT/'assets'/name).read_text(),flags=re.M) for name in ['kinematics.js','renderer.js','research.js'])
    html=html.replace('<script type="module" src="assets/research.js"></script>','')
    return html.replace('</body>','<script type="module">'+source+'</script></body>')

def run(chromium):
    result={'method':'Offline Chromium; real sources combined into an inline ES module. Not a live-site, Safari, or physical-device test.','checks':[],'viewports':[],'errors':[]}
    def check(condition,label):
        assert condition,label
        result['checks'].append(label)
    html=document()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox'])
        def page(**kwargs):
            obj=browser.new_page(**kwargs)
            obj.on('pageerror',lambda e:result['errors'].append(str(e)))
            obj.set_content(html,wait_until='load')
            obj.wait_for_selector('#viewport[data-ready="true"]')
            obj.wait_for_timeout(50)
            return obj
        snap=lambda pg:pg.evaluate('kinematicStudy.snapshot()')
        for width,height in [(320,740),(360,800),(390,844),(430,932),(580,900),(650,900),(768,1024),(820,1180),(1024,768),(1280,900),(1440,1000),(844,390)]:
            pg=page(viewport={'width':width,'height':height})
            assert not pg.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Overflow at {width}'
            for selector in ['#target-handle','#orbit-left','#orbit-right','#reset','button[data-mode="reach"]','button[data-mode="null"]','button[data-mode="trace"]']:
                box=pg.locator(selector).bounding_box()
                assert box['height']>=44 and box['width']>=44,(width,selector,box)
            assert pg.locator('#fallback').is_hidden(),'Duplicate static drawing visible'
            target=pg.locator('#target-handle').bounding_box();scene=pg.locator('#scene').bounding_box()
            assert target['x']>=scene['x'] and target['x']+target['width']<=scene['x']+scene['width']+1,(width,'target cropped')
            result['viewports'].append({'width':width,'height':height,'page_overflow':False,'primary_targets_44px':True,'initial_target_in_view':True})
            pg.close()
        pg=page(viewport={'width':1440,'height':1000})
        initial=snap(pg)
        check(initial['mode']=='reach' and not initial['playing'],'Starts in a stable pose without automatic motion')
        pg.wait_for_timeout(250);a=snap(pg);pg.wait_for_timeout(250);b=snap(pg)
        check(a['frames']==b['frames'],'Renderer is idle when no interaction is happening')
        pg.locator('#target-handle').focus();pg.keyboard.press('ArrowLeft');pg.keyboard.press('ArrowUp');pg.keyboard.press('PageUp')
        pg.wait_for_timeout(200);changed=snap(pg)
        check(abs(changed['target'][0]-initial['target'][0]+.01)<1e-9,'Keyboard changes target X by the documented step')
        check(abs(changed['target'][1]-initial['target'][1]-.01)<1e-9,'Page Up changes target depth')
        check(changed['error']<1e-5,'Keyboard target converges through IK')
        box=pg.locator('#target-handle').bounding_box();x=box['x']+24;y=box['y']+24
        pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x-45,y-20,steps=12);pg.mouse.up();pg.wait_for_timeout(200)
        check(snap(pg)['target']!=changed['target'],'Mouse drag moves the target in the view plane')
        check(snap(pg)['error']<1e-5,'Mouse target converges')
        pg.locator('#reset').click();pg.wait_for_timeout(60)
        pg.locator('button[data-mode="null"]').click();a=snap(pg);pg.wait_for_timeout(1500);b=snap(pg)
        check(b['target']==a['target'],'Null-space mode locks the actual tool point')
        check(math.dist(a['q'],b['q'])>.15,'Null-space mode produces substantial joint motion')
        check(b['error']<2e-5,'Null-space motion preserves tip position within solver tolerance')
        check(b['ghosts']>1 and b['ghosts']<=12,'Ghosts are bounded historical solver configurations')
        pg.locator('#play').click();pg.wait_for_timeout(100);a=snap(pg);pg.wait_for_timeout(200);b=snap(pg)
        check(a['q']==b['q'] and a['frames']==b['frames'],'Pause stops both kinematic and drawing loops')
        pg.locator('#parameter').evaluate("e=>{e.value='680';e.dispatchEvent(new Event('input',{bubbles:true}));}")
        pg.wait_for_timeout(100);c=snap(pg)
        check(math.dist(c['q'],b['q'])>.05 and c['target']==b['target'],'Posture slider changes internal configuration, not target')
        check(c['error']<2e-5,'Manual null-space exploration holds the tip')
        pg.locator('#axes').click();pg.locator('#ellipsoid').click()
        check(pg.locator('#axes').get_attribute('aria-pressed')=='true','Joint-axis overlay can be toggled')
        check(pg.locator('#ellipsoid').get_attribute('aria-pressed')=='true','Dexterity ellipsoid can be toggled')
        yaw=snap(pg)['cameraYaw'];pg.locator('#orbit-left').click();pg.wait_for_timeout(50)
        check(snap(pg)['cameraYaw']<yaw,'Orbit control changes the 3D projection')
        pg.locator('button[data-mode="trace"]').click();a=snap(pg);pg.wait_for_timeout(1700);b=snap(pg)
        check(math.dist(a['target'],b['target'])>.03,'Trace mode generates a moving 3D target')
        check(b['error']<1e-5 and b['trail']>10,'Trefoil is followed by the solver, with an actual tip trail')
        pg.locator('#method-link').click()
        check(pg.locator('#method-dialog').is_visible(),'Method note opens in a dialog')
        check(not snap(pg)['playing'],'Opening the method note pauses motion')
        for _ in range(12):
            pg.keyboard.press('Tab');assert pg.evaluate("document.getElementById('method-dialog').contains(document.activeElement)")
        check(True,'Method dialog contains keyboard focus')
        pg.keyboard.press('Escape')
        check(pg.locator('#method-dialog').is_hidden(),'Escape closes the method dialog')
        check(pg.evaluate("document.activeElement.id==='method-link'"),'Focus is restored after closing the dialog')
        pg.locator('#reset').click();pg.locator('button[data-mode="null"]').click();pg.wait_for_timeout(50)
        pg.set_viewport_size({'width':1440,'height':600})
        pg.evaluate("document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.body.scrollHeight)")
        pg.wait_for_timeout(120);a=snap(pg);pg.wait_for_timeout(250);b=snap(pg)
        check(a['frames']==b['frames'],'Animation suspends when the study leaves the viewport')
        pg.locator('#viewport').scroll_into_view_if_needed();pg.wait_for_timeout(200)
        check(snap(pg)['frames']>b['frames'],'Returning to the study resumes its active experiment')
        pg.locator('#motion').click();pg.locator('#viewport').scroll_into_view_if_needed();pg.wait_for_timeout(100)
        check(not snap(pg)['motion'] and not snap(pg)['playing'],'Manual motion preference disables autoplay')
        pg.close()
        reduced=page(viewport={'width':390,'height':844},reduced_motion='reduce')
        check(not snap(reduced)['motion'] and reduced.locator('#motion').is_disabled(),'System reduced-motion preference is respected')
        reduced.locator('button[data-mode="null"]').click();a=snap(reduced)
        reduced.locator('#parameter').evaluate("e=>{e.value='600';e.dispatchEvent(new Event('input',{bubbles:true}));}")
        reduced.wait_for_timeout(80);b=snap(reduced)
        check(not b['playing'] and math.dist(a['q'],b['q'])>.05,'Reduced-motion users can explore discrete postures')
        reduced.locator('button[data-mode="trace"]').click();reduced.locator('#parameter').evaluate("e=>{e.value='340';e.dispatchEvent(new Event('input',{bubbles:true}));}")
        reduced.wait_for_timeout(80)
        check(snap(reduced)['error']<1e-5 and not snap(reduced)['playing'],'Reduced-motion curve scrubbing uses the real solver')
        reduced.close()
        nojs=browser.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
        nojs.set_content(html,wait_until='load')
        check(nojs.locator('#fallback').is_visible() and nojs.locator('#scene').is_hidden(),'No-JavaScript fallback shows a static arm schematic')
        check(nojs.locator('#instrument').is_hidden(),'Nonfunctional controls are hidden without JavaScript')
        check(nojs.locator('[data-project]').count()==3 and nojs.locator('a[href^="mailto:"]').count()==1,'Work and contact remain available without JavaScript')
        nojs.close()
        mobile=page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        session=mobile.context.new_cdp_session(mobile)
        box=mobile.locator('#target-handle').bounding_box();x,y=box['x']+24,box['y']+24;before=snap(mobile)
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        for i in range(1,13):
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-i*3,'y':y-i*2}]});mobile.wait_for_timeout(20)
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mobile.wait_for_timeout(200)
        check(math.dist(snap(mobile)['target'],before['target'])>.04,'Emulated touch drag updates the target')
        check(snap(mobile)['error']<1e-5,'Touch target is solved correctly')
        check(mobile.evaluate('scrollY')==0,'Touch target dragging does not scroll the page')
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':8,'y':690}]})
        for y2 in [650,590,510,430,350]:
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':8,'y':y2}]});mobile.wait_for_timeout(20)
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mobile.wait_for_timeout(100)
        check(mobile.evaluate('scrollY')>40,'Touch gestures outside the handle scroll normally')
        mobile.close()
        check(not result['errors'],'No JavaScript runtime errors in the suite')
        browser.close()
    result['passed']=True
    return result
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--chromium',default='/usr/bin/chromium');parser.add_argument('--output',default=str(ROOT/'tests/research-browser-results.json'))
    args=parser.parse_args();result=run(args.chromium);Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    print(f"PASS: {len(result['checks'])} checks, {len(result['viewports'])} viewports, {len(result['errors'])} runtime errors.")
