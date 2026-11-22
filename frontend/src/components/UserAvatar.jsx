import { useAuthedImage } from '../hooks/useAuthedImage.js';
import { userInitials } from '../lib/format.js';

// Round avatar: the user's profile image when there is one, otherwise their initials.
// `as` lets the header render it as a link (NavLink) while other places use a plain span.
export function UserAvatar({ user, size, as: Component = 'span', className = '', ...rest }) {
  const src = useAuthedImage(user?.avatar_url);
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.34) } : undefined;

  return (
    <Component className={`avatar ${src ? 'avatar--image' : ''} ${className}`.trim()} style={style} {...rest}>
      {src ? <img src={src} alt="" /> : userInitials(user)}
    </Component>
  );
}
