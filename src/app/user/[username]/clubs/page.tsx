import { UserProfilePage } from '../UserProfilePage'

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  return <UserProfilePage username={username} tab="clubs" />
}
