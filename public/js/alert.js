/* eslint-disable */
const hideAlert = () => {
  const alertElement = document.querySelector('.alert');
  if (alertElement) {
    alertElement.parentElement.removeChild(alertElement);
  }
};

export const showAlert = (type, msg, timeSecond = 7) => {
  hideAlert();
  const markup = `<div class='alert alert--${type}'>${msg}</div>`;
  document.querySelector('body').insertAdjacentHTML('afterbegin', markup);

  window.setTimeout(hideAlert, timeSecond * 1000);
};
