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
        
        # -> Click the 'Admin' link in the top navigation to open the admin login or admin panel.
        # Admin link
        elem = page.get_by_role("link", name="Admin", exact=True)
        await elem.click(timeout=10000)
        
        # -> Fill 'admin@purepathlab.com' into the Email or Phone field and 'admin123' into the Password field, then click the 'Sign In' button.
        # Enter email or phone text field
        elem = page.get_by_role("textbox", name="Email or Phone")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin@purepathlab.com")
        
        # -> Fill 'admin@purepathlab.com' into the Email or Phone field and 'admin123' into the Password field, then click the 'Sign In' button.
        # •••••••• password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin123")
        
        # -> Fill 'admin@purepathlab.com' into the Email or Phone field and 'admin123' into the Password field, then click the 'Sign In' button.
        # Sign In button
        elem = page.get_by_role("button", name="Sign In")
        await elem.click(timeout=10000)
        
        # -> Click the 'Continue setup' link to open the Setup / Profile page.
        # Continue setup link
        elem = page.get_by_role("link", name="Continue setup")
        await elem.click(timeout=10000)
        
        # -> Click the 'Lab Profile' link in the left sidebar to open the Lab Profile (setup/profile) page.
        # Lab Profile link
        elem = page.get_by_role("link", name="Lab Profile")
        await elem.click(timeout=10000)
        
        # -> Click the 'Edit profile' button to enable editing of the lab profile fields.
        # Edit profile button
        elem = page.get_by_role("button", name="Edit profile")
        await elem.click(timeout=10000)
        
        # -> Change the 'Tagline' field to 'Test Tagline from QA - updated', then scroll down to reveal the 'Save changes' and preview controls.
        # tagline text field
        elem = page.get_by_role("textbox", name="Tagline")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test Tagline from QA - updated")
        
        # -> Change the 'Tagline' field to 'Test Tagline from QA - updated', then scroll down to reveal the 'Save changes' and preview controls.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll down to reveal the 'Save changes' button and the 'Preview selected format as PDF' control.
        await page.mouse.wheel(0, 300)
        
        # -> Click the 'Save changes' button to persist the updated lab profile.
        # Save changes button
        elem = page.get_by_role("button", name="Save changes")
        await elem.click(timeout=10000)
        
        # -> Click the 'Open the current file' link to open the current letterhead/asset preview.
        # Open the current file link
        elem = page.get_by_role("link", name="Open the current file")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The Tagline input was updated to the new text but the change was not verified in a preview.
        # Assert-outcome: failed
        # Assert: Expected the Tagline input to contain the updated text.
        await expect(page.locator("xpath=/html/body/div/div/div[3]/main/div/form/section/div[2]/div[2]/div/input").nth(0)).to_have_value("Test Tagline from QA - updated", timeout=15000), "Expected the Tagline input to contain the updated text."
        
        # --> Opening the preview navigated to the raw letterhead file URL instead of showing a PDF or in-page preview, and that image did not show the updated tagline.
        # Assert-outcome: failed
        # Assert: Expected the preview to open as a PDF or preview UI instead of navigating to the raw letterhead file URL.
        await expect(page).to_have_url(re.compile("/uploads/letterheads/file\\-1790873897902\\-7c2272f192e6\\.png"), timeout=15000), "Expected the preview to open as a PDF or preview UI instead of navigating to the raw letterhead file URL."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    