(function () {
    const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA;
    let recaptchaLoadPromise = null;

    function loadRecaptcha() {
        if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
            return Promise.resolve();
        }

        if (recaptchaLoadPromise) {
            return recaptchaLoadPromise;
        }

        recaptchaLoadPromise = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = 'https://www.google.com/recaptcha/api.js?render=' + RECAPTCHA_SITE_KEY;
            script.onload = function () {
                resolve();
            };
            script.onerror = function () {
                reject(new Error('Unable to load reCAPTCHA script'));
            };
            document.head.appendChild(script);
        });

        return recaptchaLoadPromise;
    }

    function getBrowserInfo() {
        const ua = navigator.userAgent;
        if (/Edg\//.test(ua))     { return { name: 'Edge',    version: (ua.match(/Edg\/(\d+)/)     || [])[1] || '' }; }
        if (/Chrome\//.test(ua))  { return { name: 'Chrome',  version: (ua.match(/Chrome\/(\d+)/)  || [])[1] || '' }; }
        if (/Firefox\//.test(ua)) { return { name: 'Firefox', version: (ua.match(/Firefox\/(\d+)/) || [])[1] || '' }; }
        if (/Safari\//.test(ua))  { return { name: 'Safari',  version: (ua.match(/Version\/(\d+)/) || [])[1] || '' }; }
        return { name: 'Unknown', version: '' };
    }

    function getOS() {
        const ua = navigator.userAgent;
        if (/Windows/.test(ua))     { return 'Windows'; }
        if (/Mac OS/.test(ua))      { return 'Mac OS'; }
        if (/Android/.test(ua))     { return 'Android'; }
        if (/iPhone|iPad/.test(ua)) { return 'iOS'; }
        if (/Linux/.test(ua))       { return 'Linux'; }
        return 'Unknown';
    }

    function fieldValue(name) {
        const el = form.querySelector('[name="' + name + '"]');
        return el ? el.value : '';
    }

    const form = document.getElementById('page-feedback-form');
    const details = document.getElementById('page-feedback-details');
    const label = document.getElementById('pageFeedbackCommentLabel');
    const radios = form.querySelectorAll('input[name="data.useful"]');
    const success = document.getElementById('page-feedback-success');
    const error = document.getElementById('page-feedback-error');
    const submitButton = document.getElementById('page-feedback-submit');
    const submitButtonDefault = submitButton.innerHTML;
    const submitButtonLoading = '<div class="spinner-border spinner-border-sm me-2" aria-hidden="true"></div>Submitting...';

    function setButtonLoading(loading) {
        if (loading) {
            submitButton.classList.add('btn-progress', 'loading');
            submitButton.innerHTML = submitButtonLoading;
            submitButton.disabled = true;
        } else {
            submitButton.disabled = false;
            submitButton.classList.remove('btn-progress', 'loading');
            submitButton.innerHTML = submitButtonDefault;
        }
    }

    document.getElementById('data-page-title').value = document.title;
    document.getElementById('data-page-url').value = window.location.href;
    document.getElementById('data-page-referer').value = document.referrer;

    radios.forEach(function (radio) {
        radio.addEventListener('change', function () {
            loadRecaptcha().catch(function (err) {
                console.error('reCAPTCHA preload error:', err);
            });
            details.hidden = false;
            if (radio.value === 'yes') {
                label.textContent = 'What worked well for you (optional)';
            }
            if (radio.value === 'no') {
                label.textContent = 'What didn’t work for you (optional)';
            }
        });
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        error.hidden = true;
        success.hidden = true;

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        setButtonLoading(true);
        loadRecaptcha()
            .then(function () {
                return new Promise(function (resolve, reject) {
                    if (!window.grecaptcha || typeof window.grecaptcha.ready !== 'function') {
                        reject(new Error('reCAPTCHA is not available'));
                        return;
                    }
                    window.grecaptcha.ready(resolve);
                });
            })
            .then(function () {
                return window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'feedback' });
            })
                .then(function (token) {
                    const usefulRadio = form.querySelector('input[name="data.useful"]:checked');
                    const tzOffset = -new Date().getTimezoneOffset();
                    const payload = {
                        data: {
                            'useful':           usefulRadio ? usefulRadio.value : '',
                            'feedback-a':       fieldValue('data.feedback-a'),
                            'feedback-b':       fieldValue('data.feedback-b'),
                            'feedback-c':       fieldValue('data.feedback-c'),
                            'feedback-d':       fieldValue('data.feedback-d'),
                            'dataset-owner':    fieldValue('data.dataset-owner'),
                            'page-title':       document.getElementById('data-page-title').value,
                            'page-url':         document.getElementById('data-page-url').value,
                            'page-referer':     document.getElementById('data-page-referer').value,
                            'rspUsrAgent':      navigator.userAgent,
                            'browserName':      getBrowserInfo(),
                            'OS':               getOS(),
                            'franchise':        fieldValue('data.franchise'),
                            'captchaCatch':     fieldValue('data.captchaCatch'),
                            'captcha-honeypot': fieldValue('data.captcha'),
                            'feedback-captcha': fieldValue('feedback-captcha'),
                            'comments':         document.getElementById('pageFeedbackComment').value,
                            'submit':           true,
                            'captcha':          { token: token }
                        },
                        metadata: {
                            timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
                            offset:      tzOffset,
                            origin:      window.location.origin,
                            referrer:    document.referrer,
                            browserName: navigator.appName,
                            userAgent:   navigator.userAgent,
                            pathName:    window.location.pathname,
                            onLine:      navigator.onLine
                        },
                        state:  'submitted',
                        _vnote: ''
                    };

                    fetch(form.action, {
                        method: form.method || 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    })
                        .then(function (response) {
                            if (!response.ok) {
                                throw new Error('Submission failed with status ' + response.status);
                            }
                            form.hidden = true;
                            success.hidden = false;
                        })
                        .catch(function (err) {
                            console.error('Feedback form submission error:', err);
                            form.hidden = true;
                            error.hidden = false;
                            error.removeAttribute('hidden');
                        });
                })
                .catch(function (err) {
                    console.error('reCAPTCHA error:', err);
                    form.hidden = true;
                    error.hidden = false;
                    error.removeAttribute('hidden');
                });
    });
})();