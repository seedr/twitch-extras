(() =>
{

    const data = {
        observers: {},
        timers: {},
        events: {
            onUrlChange: []
        }
    };

    const pipe = (...messages) =>
    {
        console.info(`[TWITCH EXTRAS]`, ...messages)
    }

	const dispatchEvent = (element, eventType, event) =>
	{
		element.dispatchEvent(new eventType(event,
		{
			bubbles: true,
			cancelable: true,
			view: window
		}));
	};

    const rTrim = (string, character) =>
    {
        if(string.substr(string.length - 1) === character)
        {
            return string.slice(0, -1);
        }

        return string;
    };

    const sanitizeFilename = (string) =>
	{
        return string.replace(
            /[^\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\wа-я0-9a-zA-Z-._ #()\[\]]/g, ''
        ).replace(/\s\s+/g, ' ').trim();
	}

    data.currentUrl = rTrim(document.location.href, '/');

    let attemptClipInject = () =>
    {
        let root = document.querySelector('div[class*="channel-root"]')
        let videoPlayer = document.querySelector('div[class*="video-player"] video');
        let shareContainer  = document.querySelector('div.channel-info-content div[class*="metadata-layout"] \
            div:nth-child(2) > div > div');
        
        let hasInjected = false;

        let updateSource = (event) =>
        {
            let button = document.querySelector('a.downloadClipButton');

            if(event.target && button)
            {
                button.setAttribute('href', event.target.src);
            }
        };

        let injectButton = (share, video) =>
        {
            let button = document.createElement('a');

            /** Set class properties */
            button.classList.add('downloadClipButton');
            button.setAttribute('href', video.src);

            /** Add progress update for updating clip URL change */
            video.removeEventListener('progress', updateSource, true);
            video.addEventListener('progress', updateSource, true);

            /** On button click event */
            button.addEventListener('click', (e) =>
            {
                e.preventDefault();

                if(e.isDownloading)
                {
                    return false;
                }

                /** Set download state */
                e.isDownloading = true;
                e.target.classList.add('isDownloading');

                let url = e.target.getAttribute('href'),
                    videoTitle = document.querySelector('h2[data-a-target="stream-title"]'),
                    filename = null;

                if(videoTitle)
                {
                    /** Get video title */
                    filename = sanitizeFilename(videoTitle.getAttribute('title')) + '.mp4';
                } else {
                    /** Fallback: extract filename from URL */
                    let expression = /[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/;
                    let matches = new RegExp(expression).exec(url);

                    if(matches.length > 0)
                    {
                        filename = matches[0];
                    } else {
                        filename = `${Date.now()}.mp4`;
                    }
                }

                /** Download file */
                chrome.runtime.sendMessage(
                    chrome.runtime.id, {
                        task: 'fileDownload',
                        filename: filename,
                        url: e.target.getAttribute('href')
                    }).then(() =>
                    {
                        /** Set download state */
                        e.isDownloading = false;
                        e.target.classList.remove('isDownloading');
                    }).catch((error) =>
                    {
                        pipe('ERROR:', error)

                        /** Set download state */
                        e.isDownloading = false;
                        e.target.classList.remove('isDownloading');
                    });
            });

            share.prepend(button);

            hasInjected = true;

            console.log('Button injected.');

            return hasInjected;
        }

        if(!(root && videoPlayer && shareContainer))
        {
            data.observers.shareInject = new MutationObserver((mutations) =>
            {
                mutations.forEach(() =>
                {
                    root = document.querySelector('div[class*="channel-root"]')
                    videoPlayer = document.querySelector('div[class*="video-player"] video');
                    shareContainer  = document.querySelector('div.channel-info-content div[class*="metadata-layout"] \
                        div:nth-child(2) > div > div');

                    if(root && videoPlayer && shareContainer && !hasInjected)
                    {
                        injectButton(shareContainer, videoPlayer);

                        data.observers.shareInject.disconnect();
                    }
                });
            });
            
            data.observers.shareInject.observe(root, {
                childList: true,
                subtree: true
            });
        }
    };

    let onUrlChange = (url) =>
    {
        pipe('URL change detected.');

        if(data.events.onUrlChange.length > 0)
        {
            (data.events.onUrlChange).forEach((event) =>
            {
                event.function(
                    ...(event.parameters ? event.parameters : [])
                );
            });
        }

        /** Clear observers */
        if(data.observers.shareInject)
        {
            data.observers.shareInject.disconnect();
        }

        /** Redirect to live page */
        if(url.endsWith('/directory/following'))
        {
            window.location.href = 'https://www.twitch.tv/directory/following/live';
        }

        /** Attempt clip download injection */
        if(url.includes('/clip/'))
        {
            attemptClipInject();
        }
    };

    /** Redirect to live page */
    if(data.currentUrl.endsWith('/directory/following'))
    {
        window.location.href = 'https://www.twitch.tv/directory/following/live';
    }

    let observer = new MutationObserver((mutations) =>
    {
        mutations.forEach(() =>
        {
            if(data.currentUrl !== document.location.href)
            {
                data.currentUrl = rTrim(document.location.href, '/');

                onUrlChange(data.currentUrl);
            }
        });
    });
    
    let config = {
        childList: true,
        subtree: true
    };

    /** Claims any bonus channel points */
    const claimChatBonusPoints = (container) =>
    {
        let claimButton = container.querySelector('button[aria-label^="Claim"] div > svg');

        if(claimButton)
        {
            dispatchEvent(claimButton, MouseEvent, 'click');

            pipe('Claimed bonus channel points.')
        }
    };

    /** Add a `chatInput` detector on URL change (for channel point observing) */
    data.events.onUrlChange.push({
        function: () =>
        {
            clearInterval(data.timers.chatInputFinder);

            /** Disconnect any already active observer */
            if(data.observers.channelPointObserver)
            {
                data.observers.channelPointObserver.disconnect();
            }

            data.timers.chatInputFinder = setInterval(() =>
            {
                let chatInput = document.querySelector('div.chat-room__content div.chat-input, \
                    div.chat-room__content div.chat-input');

                /** Chat input has been found */
                if(chatInput)
                {
                    /** Again, disconnect any already active observer */
                    if(data.observers.channelPointObserver)
                    {
                        data.observers.channelPointObserver.disconnect();
                    }

                    clearInterval(data.timers.chatInputFinder);

                    data.observers.channelPointObserver = new MutationObserver((mutations) =>
                    {
                        mutations.forEach(() =>
                        {
                            clearTimeout(data.timers.debounceChatInputMutation);

                            /** Add a debounce to the action */
                            data.timers.debounceChatInputMutation = setTimeout(() =>
                            {
                                /** Attempt to claim bonus points */
                                claimChatBonusPoints(chatInput);
                            }, 250);
                        });
                    });
                    
                    data.observers.channelPointObserver.observe(chatInput, {
                        childList: true,
                        subtree: true
                    });
                }
            }, 1000);
        },
        parameters: []
    });

    /** Clear any download buttons from the DOM */
    data.events.onUrlChange.push({
        function: () =>
        {
            let downloadButtons = document.querySelectorAll('div.downloadClipButton');

            if(downloadButtons)
            {
                downloadButtons.forEach((element) => element.remove());
            }
        }
    })

    observer.observe(document.querySelector('body'), config);

    onUrlChange(data.currentUrl);

    pipe('Twitch Extras loaded.');
})();