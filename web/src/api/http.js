import req from './request';

// ---- auth / user ----
export const login = (body) => req.post('/api/user/login', body);
export const register = (body) => req.post('/api/user/register', body);
export const logout = () => req.post('/api/user/logout');
export const getInfo = () => req.post('/api/user/info');
export const getMenu = () => req.post('/api/user/menu');
export const updateUserInfo = (body) => req.post('/api/user/update_user_info', body);
export const updateAccount = (body) => req.post('/api/user/update', body);
export const changePassword = (body) => req.post('/api/user/change-password', body);
export const updateEmail = (body) => req.post('/api/user/updateEmail', body);
export const emsSend = (body) => req.post('/api/ems/send', body);
export const emsCheck = (body) => req.post('/api/ems/check', body);
export const getUserConfig = () => req.get('/api/optconfig/getUserConfig');
export const updateUserFb = (body) => req.post('/api/optconfig/updateUserFb', body);

// ---- membership / pay ----
export const getServiceList = () => req.get('/api/pay/getServiceList');
export const getMyServices = () => req.get('/api/pay/getMyservicesList');
export const getMyOrders = () => req.get('/api/pay/getMyorder');
export const getRecords = (uid, module_id) => req.get(`/api/pay/getRecords?uid=${uid}&module_id=${module_id}`);
export const addRecord = (body) => req.post('/api/pay/addRecord', body);
export const createPaymentIntent = (body) => req.post('/api/pay/createPaymentIntent', body);
export const cryptomus = (body) => req.post('/api/pay/cryptomus', body);
export const mockConfirm = (ordernum) => req.get(`/api/pay/mockConfirm?ordernum=${ordernum}`);
export const promoInfo = (promo) => req.get(`/api/pay/promoInfo?promo=${encodeURIComponent(promo)}`);

// ---- FB "operating" accounts (bound via plugin) ----
export const accountList = (uid) => req.get(`/api/account/accountList?uid=${uid}`);
export const addAccount = (body) => req.post('/api/account/addAccount', body);

// ---- module data (mocked scrape results) ----
export const moduleList = (name, params = '') => req.get(`/api/mock/${name}${params}`);
export const moduleAction = (body) => req.post('/api/mock/action', body);
export const setNote = (body) => req.post('/api/mock/setNote', body);
export const toggleFav = (body) => req.post('/api/mock/toggleFav', body);
export const createPages = (body) => req.post('/api/mock/createPages', body);

// ---- interest targeting ----
export const interestSearch = (kw) => req.get(`/api/keywordsx/search?kw=${encodeURIComponent(kw)}`);
export const keywordFiles = (uid) => req.get(`/api/keywordsx/index?uid=${uid}&page=1&limit=100`);
export const saveKeywordFile = (uid, body) => req.post(`/api/keywordsx/save?uid=${uid}`, body);
export const deleteKeywordFile = (uid, id) => req.get(`/api/keywordsx/delete?uid=${uid}&id=${id}`);
export const keywordItems = (uid, cat) => req.get(`/api/keywords_item/index?uid=${uid}&cat=${cat}`);

// ---- support tickets ----
export const ticketList = () => req.get('/api/support/list');
export const ticketCreate = (body) => req.post('/api/support/create', body);
export const ticketDetail = (id) => req.get(`/api/support/detail?id=${id}`);
export const ticketReply = (body) => req.post('/api/support/reply', body);
