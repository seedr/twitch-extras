/**
 * Attempts to download a file using `chrome.downloads.download`
 * 
 * @param {object} args 
 */
 const fileDownload = (args) =>
 {
     let [filename, url, subFolder] = [
         args.data.filename,
         args.data.url,
         args.data.subFolder
     ];
 
     if(subFolder && subFolder.length > 1 && !subFolder.endsWith('/'))
     {
         subFolder = (subFolder + '/');
     }
 
     try
     {
         chrome.downloads.download({
             conflictAction: 'uniquify',
             filename: `${subFolder ? subFolder : ''}${filename}`,
             url: url,
             method: 'GET',
             saveAs: false
         }, (itemId) =>
         {
             chrome.downloads.onChanged.addListener((delta) =>
             {
                 if(itemId === delta.id)
                 {
                     if(delta.endTime ||
                         (delta.state && delta.state.current === 'complete'))
                     {
                         /** Successful download */
                         args.sendResponse({
                             itemId: itemId,
                             success: true
                         });
                     } else if(delta.error)
                     {
                         /** Error encountered */
                         args.sendResponse({
                             success: false
                         });
                     }
                 }      
             });
         });
     } catch(error) {
         /** Error encountered */
         args.sendResponse({
             success: false
         });
     }
 };

 /**
 * `onMessage` listener
 */
chrome.runtime.onMessage.addListener((data, sender, sendResponse) =>
{
	/** Task IDs and their corresponding functions */
	let tasks = {
		'fileDownload': fileDownload
	};

	if(tasks[data.task])
	{
		/** Perform task */
		tasks[data.task]({
			data,
			sender,
			sendResponse
		});
	}

	return true;
});