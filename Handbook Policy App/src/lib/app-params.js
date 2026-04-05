const isNode = typeof window === 'undefined';
/** @type {Storage} */
const storage = isNode
  ? { setItem() {}, getItem() { return null; }, removeItem() {}, length: 0, key() { return null; }, clear() {} }
  : window.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `noblehr_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);

	// access_token: never persist to or read from localStorage (Fix 1 — no JWT in localStorage).
	if (paramName === 'access_token') {
		if (removeFromUrl && searchParam != null) {
			urlParams.delete(paramName);
			const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}${window.location.hash}`;
			window.history.replaceState({}, document.title, newUrl);
		}
		return searchParam ?? null;
	}

	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('noblehr_access_token');
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	// Never leave JWT in localStorage: clear any previously stored access token (Fix 1).
	if (!isNode) {
		storage.removeItem('noblehr_access_token');
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_APP_ID }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_FUNCTIONS_VERSION }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_APP_BASE_URL }),
	}
}


export const appParams = {
	...getAppParams()
}
