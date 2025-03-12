import { useAtom } from "jotai"
import { userAtom } from "../store"

export default function Dashboard() {
  const [user] = useAtom(userAtom)
  return (
    <div>{JSON.stringify(user)}</div>
  )
}
