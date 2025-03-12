import useSignInOut from "../hooks/useSignInOut";

export default function DashboardNav() {
    const { logoutWithRedirect } = useSignInOut();
  return (
    <div className="" onClick={logoutWithRedirect}>logout</div>
  )
}
