// API router. In the static (GitHub Pages) build there is no backend, so we use
// the localStorage-backed implementation; otherwise we talk to the Node server.
// Live Facebook data always comes from the extension bridge, independent of this.
import * as http from './http';
import * as local from './local';

// standalone when built with VITE_STANDALONE=1, or when served off a static host
// (github.io / file://) where no /api backend exists.
const STANDALONE =
  import.meta.env.VITE_STANDALONE === '1' ||
  /github\.io$/.test(location.hostname) ||
  location.protocol === 'file:';

const impl = STANDALONE ? local : http;
export const isStandalone = STANDALONE;

// re-export every API function through the chosen implementation
export const login = (...a) => impl.login(...a);
export const register = (...a) => impl.register(...a);
export const logout = (...a) => impl.logout(...a);
export const getInfo = (...a) => impl.getInfo(...a);
export const getMenu = (...a) => impl.getMenu(...a);
export const updateUserInfo = (...a) => impl.updateUserInfo(...a);
export const updateAccount = (...a) => impl.updateAccount(...a);
export const changePassword = (...a) => impl.changePassword(...a);
export const updateEmail = (...a) => impl.updateEmail(...a);
export const emsSend = (...a) => impl.emsSend(...a);
export const emsCheck = (...a) => impl.emsCheck(...a);
export const getUserConfig = (...a) => impl.getUserConfig(...a);
export const updateUserFb = (...a) => impl.updateUserFb(...a);

export const getServiceList = (...a) => impl.getServiceList(...a);
export const getMyServices = (...a) => impl.getMyServices(...a);
export const getMyOrders = (...a) => impl.getMyOrders(...a);
export const getRecords = (...a) => impl.getRecords(...a);
export const addRecord = (...a) => impl.addRecord(...a);
export const createPaymentIntent = (...a) => impl.createPaymentIntent(...a);
export const cryptomus = (...a) => impl.cryptomus(...a);
export const mockConfirm = (...a) => impl.mockConfirm(...a);
export const promoInfo = (...a) => impl.promoInfo(...a);

export const accountList = (...a) => impl.accountList(...a);
export const addAccount = (...a) => impl.addAccount(...a);

export const moduleList = (...a) => impl.moduleList(...a);
export const moduleAction = (...a) => impl.moduleAction(...a);
export const setNote = (...a) => impl.setNote(...a);
export const toggleFav = (...a) => impl.toggleFav(...a);
export const createPages = (...a) => impl.createPages(...a);

export const interestSearch = (...a) => impl.interestSearch(...a);
export const keywordFiles = (...a) => impl.keywordFiles(...a);
export const saveKeywordFile = (...a) => impl.saveKeywordFile(...a);
export const deleteKeywordFile = (...a) => impl.deleteKeywordFile(...a);
export const keywordItems = (...a) => impl.keywordItems(...a);

export const ticketList = (...a) => impl.ticketList(...a);
export const ticketCreate = (...a) => impl.ticketCreate(...a);
export const ticketDetail = (...a) => impl.ticketDetail(...a);
export const ticketReply = (...a) => impl.ticketReply(...a);
