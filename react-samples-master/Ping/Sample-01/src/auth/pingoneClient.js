import { UserManager, WebStorageStateStore } from "oidc-client-ts";

let userManager;

export const getPingOneManager = (config) => {
  if (userManager) return userManager;

  const extraQueryParams = config.audience
    ? { resource: config.audience }
    : undefined;

  const userStore = new WebStorageStateStore({
    store: window.localStorage,
    prefix: "pingone.user.",
  });
  const stateStore = new WebStorageStateStore({
    store: window.localStorage,
    prefix: "pingone.state.",
  });

  userManager = new UserManager({
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: "code",
    scope: config.scope,
    extraQueryParams,
    userStore,
    stateStore,
    loadUserInfo: true,
    automaticSilentRenew: false,
  });

  return userManager;
};
