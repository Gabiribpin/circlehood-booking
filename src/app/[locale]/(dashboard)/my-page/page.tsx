import { redirect } from 'next/navigation';

/**
 * Legacy /my-page route — redirects to the consolidated /my-page-editor.
 * Kept so bookmarks / old links still work.
 */
export default function MyPageRedirect() {
  redirect('/my-page-editor');
}
