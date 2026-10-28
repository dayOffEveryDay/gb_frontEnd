export default function SuccessToast({ toast: successToast, onDismiss }) {
  return (
    <button
      type="button"
      className="live-notification-toast success-toast"
      onClick={onDismiss}
    >
      <strong>{successToast.title}</strong>
      <span>{successToast.message}</span>
    </button>
  );
}
