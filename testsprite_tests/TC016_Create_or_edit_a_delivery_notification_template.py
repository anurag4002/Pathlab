import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Admin' link in the top navigation to open the admin/login area.
        # Admin link
        elem = page.get_by_role("link", name="Admin", exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'admin@purepathlab.com' into the 'Email or Phone' field, fill 'admin123' into the 'Password' field, then click the 'Sign In' button.
        # Enter email or phone text field
        elem = page.get_by_role("textbox", name="Email or Phone")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin@purepathlab.com")
        
        # -> Fill 'admin@purepathlab.com' into the 'Email or Phone' field, fill 'admin123' into the 'Password' field, then click the 'Sign In' button.
        # •••••••• password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin123")
        
        # -> Fill 'admin@purepathlab.com' into the 'Email or Phone' field, fill 'admin123' into the 'Password' field, then click the 'Sign In' button.
        # Sign In button
        elem = page.get_by_role("button", name="Sign In")
        await elem.click(timeout=10000)
        
        # -> Click the 'Manage' menu in the left sidebar to reveal delivery-related options.
        # Manage button
        elem = page.get_by_role("button", name="Manage")
        await elem.click(timeout=10000)
        
        # -> Click the 'Templates' link in the Manage menu to open the Delivery → Templates page.
        # Templates link
        elem = page.get_by_role("link", name="Templates")
        await elem.click(timeout=10000)
        
        # -> Click the 'New Template' button to open the template creation form.
        # New Template button
        elem = page.get_by_role("button", name="New Template")
        await elem.click(timeout=10000)
        
        # -> Fill the 'Key' field, leave 'Channel (sms/whatsapp/email)' as sms, enter the template 'Body', and click the 'Save' button in the 'Edit Template' dialog.
        # text field
        elem = page.locator("div").filter(has_text=re.compile(r"^Key\*$")).get_by_role("textbox")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("autotest_sms_20261001_1002")
        
        # -> Fill the 'Key' field, leave 'Channel (sms/whatsapp/email)' as sms, enter the template 'Body', and click the 'Save' button in the 'Edit Template' dialog.
        # text area
        elem = page.get_by_text("Automated SMS template saved on 2026-10-01. Reference: {{regNo}}")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Automated SMS template saved on 2026-10-01. Reference: {{regNo}}.")
        
        # -> Fill the 'Key' field, leave 'Channel (sms/whatsapp/email)' as sms, enter the template 'Body', and click the 'Save' button in the 'Edit Template' dialog.
        # Save button
        elem = page.get_by_role("button", name="Save")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The saved template 'autotest_sms_20261001_1002' appears in the templates list with the entered body text.
        # Assert-outcome: passed
        # Assert: Key cell equals the saved template key.
        await expect(page.locator("xpath=/html/body/div/div/div[3]/main/div/div/div[2]/table/tbody/tr[4]/td[1]").nth(0)).to_have_text("autotest_sms_20261001_1002", timeout=15000), "Key cell equals the saved template key."
        # Assert-outcome: passed
        # Assert: Body cell contains the saved template body text.
        await expect(page.locator("tbody").nth(0)).to_contain_text("Automated SMS template saved on 2026-10-01. Reference: {{regNo}}.", timeout=15000), "Body cell contains the saved template body text."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    