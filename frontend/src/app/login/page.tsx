import { AuthForm } from '@/components/AuthForm';
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  return <AuthForm mode="login" configurationNotice={notice === 'configuration'}/>;
}
