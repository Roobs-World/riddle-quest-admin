/** Opens the Solar game fixture and waits until its gameplay keyboard admits input. */
export async function openSolarGame(page,url) {
 await page.goto(url);
 await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
 const play=page.getByRole('button',{name:"Let's Play",exact:true});
 if(await play.count())await play.click();
 await page.locator('.keyboard .key:not(:disabled)').first().waitFor();
}
