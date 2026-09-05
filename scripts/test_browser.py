#!/usr/bin/env python3
"""Offline Chromium interaction tests. Requires the Python playwright package.
Run: python3 scripts/test_browser.py --chromium /usr/bin/chromium
Network is not used. HTML, CSS and JS are inlined from the real source files.
"""
import argparse
import json
import math
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def document():
    html = (ROOT / 'index.html').read_text()
    html = html.replace('<link rel="stylesheet" href="assets/lab.css">', '<style>' + (ROOT / 'assets/lab.css').read_text() + '</style>')
    html = html.replace('<script src="assets/lab.js" defer></script>', '')
    return html.replace('</body>', '<script>' + (ROOT / 'assets/lab.js').read_text() + '</script></body>')

def test(chromium):
    report = {'method': 'Offline Chromium; real source inlined; not a live-network or physical-device test', 'checks': [], 'viewports': [], 'errors': []}
    html = document()
    def check(condition, label):
        assert condition, label
        report['checks'].append(label)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium, headless=True, args=['--no-sandbox'])
        def new_page(**kwargs):
            page = browser.new_page(**kwargs)
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.set_content(html, wait_until='load')
            return page
        for width, height in [(320,740),(360,800),(390,844),(430,932),(580,900),(650,900),(768,1024),(820,1180),(1024,768),(1280,900),(1440,1000),(844,390)]:
            page = new_page(viewport={'width':width,'height':height})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'Horizontal page overflow at {width}'
            assert page.locator('[data-project]').count() == 3
            for selector in ['#surprise','#replay','#clear','#xray','#greet']:
                box=page.locator(selector).bounding_box()
                assert box['width']>=43.9 and box['height']>=43.9, (width,selector,box)
            lab=page.locator('#lab').bounding_box()
            assert lab['x']>=0 and lab['x']+lab['width']<=width+1
            report['viewports'].append({'width':width,'height':height,'overflow':False,'main_controls_at_least_44px':True})
            page.close()
        page=new_page(viewport={'width':1440,'height':1000})
        check(page.locator('#replay').is_disabled(), 'Replay disabled on empty paper')
        check(page.locator('#sound').get_attribute('aria-pressed')=='false','Sound is opt-in and off initially')
        box=page.locator('#draw-zone').bounding_box()
        x,y=box['x']+20,box['y']+box['height']*.5
        page.mouse.move(x,y);page.mouse.down()
        for i in range(1,31): page.mouse.move(x+i*6,y+math.sin(i*.25)*25)
        page.mouse.up()
        check(page.locator('#ink path').count()==1,'Mouse drawing creates one continuous stroke')
        original=page.locator('#ink path').get_attribute('d')
        check(original.count('L')>=25,'Mouse path retains sampled points')
        check(page.locator('#lab').get_attribute('data-state')=='ready','Pointer release ends drawing')
        page.locator('#replay').click();page.wait_for_function("document.getElementById('lab').dataset.state==='ready'")
        check(page.locator('#ink path').get_attribute('d')==original,'Replay preserves the exact input path')
        page.locator('#xray').click()
        check('is-xray' in page.locator('#lab').get_attribute('class'),'X-ray reveals mechanism')
        page.locator('#xray').click()
        page.locator('#greet').click()
        check('Hello, human' in page.locator('#robot-status').inner_text(),'Robot greeting works')
        page.locator('#clear').click()
        check(page.locator('#ink path').count()==0 and page.locator('#replay').is_disabled(),'Clear resets ink and replay state')
        page.locator('#draw-zone').focus()
        page.keyboard.press('Space')
        for key in ['ArrowLeft']*5+['ArrowUp']*5+['ArrowRight']*5:page.keyboard.press(key)
        page.keyboard.press('Space')
        check(page.locator('#ink path').count()==1 and page.locator('#ink path').get_attribute('d').count('L')==15,'Keyboard-only drawing works')
        page.keyboard.press('Enter')
        page.wait_for_function("document.getElementById('lab').dataset.state==='ready'")
        check(True,'Keyboard replay completes')
        # Verify the upper and lower link endpoints meet, and the wrist is 30 units above the pen.
        geometry=page.evaluate('''() => {
          const u=document.getElementById('upper-arm').transform.baseVal.consolidate().matrix;
          const f=document.getElementById('forearm').transform.baseVal.consolidate().matrix;
          const t=document.getElementById('tool').transform.baseVal.consolidate().matrix;
          return {elbow:Math.hypot(u.a*156+u.e-f.e,u.b*156+u.f-f.f),
          wrist:Math.hypot(f.a*180+f.e-t.e,f.b*180+f.f-(t.f-30))};
        }''')
        check(geometry['elbow']<.1 and geometry['wrist']<.1,'Inverse-kinematics joints meet the actual pen position')
        for _ in range(3):page.locator('#surprise').click()
        page.locator('#replay').click()
        check(page.locator('#lab').get_attribute('data-state')=='ready','Rapid preset changes and Stop cancel stale animation frames')
        check(page.locator('#ink path').count()==5,'Latest preset survives interrupted playback')
        page.locator('[data-project="brushos"]').click()
        check(page.locator('#project-dialog').is_visible(),'Project opens in native dialog')
        check('live connection' in page.locator('#project-caveat').inner_text(),'Simulation is distinguished from the real BrushOS robot')
        for _ in range(12):
            page.keyboard.press('Tab')
            assert page.evaluate("document.querySelector('#project-dialog').contains(document.activeElement)"), 'Dialog focus escaped'
        check(True,'Dialog keyboard focus remains contained')
        page.keyboard.press('Escape')
        check(not page.locator('#project-dialog').is_visible(),'Escape closes project dialog')
        check(page.evaluate("document.activeElement.matches('[data-project=brushos]')"),'Dialog restores focus to the project card')
        page.locator('header [data-about]').click()
        check(page.locator('#about-dialog').is_visible(),'About opens without leaving the page')
        page.locator('#about-dialog .close-dialog').click()
        page.locator('#motion').click()
        page.locator('#surprise').click()
        check(page.locator('#lab').get_attribute('data-state')!='playing','Motion toggle skips animated playback')
        check(page.locator('#ink path').count()>0,'Motion-off mode still draws complete presets')
        page.close()
        reduced=new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
        check(reduced.locator('html').get_attribute('data-motion')=='off','System reduced-motion preference respected at startup')
        check(reduced.locator('#motion').is_disabled(),'System reduced motion cannot be accidentally overridden')
        reduced.locator('#surprise').click()
        check(reduced.locator('#ink path').count()==3,'Reduced-motion preset renders without animation')
        check(reduced.locator('#eyes').evaluate("e=>getComputedStyle(e).animationName")=='none','Reduced motion disables blinking')
        reduced.close()
        nojs=browser.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
        nojs.set_content(html,wait_until='load')
        check(nojs.locator('[data-project]').count()==3,'All three project links remain available without JavaScript')
        check(nojs.locator('#lab-controls').is_hidden(),'Nonfunctional play controls hidden without JavaScript')
        check(nojs.locator('a[href="mailto:jatindehmiwal@gmail.com"]').count()==1,'Contact remains available without JavaScript')
        check('translate(491 475)' in nojs.locator('#tool').get_attribute('transform'),'Robot pose has a static no-JavaScript fallback')
        nojs.close()
        mobile=new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        session=mobile.context.new_cdp_session(mobile)
        b=mobile.locator('#draw-zone').bounding_box()
        x,y=b['x']+15,b['y']+b['height']*.55
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        for i in range(1,18):
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+i*8,'y':y+math.sin(i/2)*18}]})
            mobile.wait_for_timeout(18)
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        check(mobile.locator('#ink path').count()==1,'Real emulated touch input creates a stroke')
        check(mobile.locator('#ink path').get_attribute('d').count('L')>=10,'Touch drag records path points')
        check(mobile.evaluate('scrollY')==0,'Drawing on the paper does not scroll the page')
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':6,'y':700}]})
        for y2 in [660,610,550,480,400]:
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':6,'y':y2}]})
            mobile.wait_for_timeout(20)
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        mobile.wait_for_timeout(100)
        check(mobile.evaluate('scrollY')>30,'Touch scrolling works outside the drawing paper')
        mobile.close()
        check(not report['errors'],'No JavaScript runtime errors during the suite')
        browser.close()
    report['passed']=True
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium',default='/usr/bin/chromium')
    parser.add_argument('--output',default=str(ROOT/'tests/browser-results.json'))
    args=parser.parse_args()
    report=test(args.chromium)
    path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,indent=2)+'\n')
    print(f"PASS: {len(report['viewports'])} viewports, {len(report['checks'])} checks, {len(report['errors'])} runtime errors.")
