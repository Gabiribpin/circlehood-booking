import { Skeleton } from '@/components/ui/skeleton';

export default function PublicLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto pb-8">
        {/* Cover */}
        <Skeleton className="h-48 w-full rounded-none" />
        {/* Avatar */}
        <div className="flex justify-center -mt-12">
          <Skeleton className="h-24 w-24 rounded-full" />
        </div>
        {/* Name + bio */}
        <div className="mt-4 px-4 space-y-3">
          <Skeleton className="h-7 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        {/* Services */}
        <div className="mt-8 px-4 space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
