import { Link } from 'react-router-dom';
import useSiteMetadata from '@/hooks/useSiteMetadata';

const Header = () => {
  const { logo, siteUrl, navLinks } = useSiteMetadata();
  const currentPageUrl = window.location.pathname;
  return (
    <>
 <div className="header">
    <div className="header-menu">
          {navLinks.map((n, i) => (
            <a
              key={i}
              href={n.url}
              className={currentPageUrl === n.url ? 'menu-gaoliang' : ''}
              target={n.target || '_self'} // 添加 target 属性
              rel={n.target ? 'noopener noreferrer' : undefined} // 添加 rel 属性以提高安全性
            >
              {n.name}
            </a>
          ))}    
    </div>
  <div className="header-right"> 
    <div className="about-koobai">
      <a href="https://koobai.com/about/" alt="koobai" title="我">
        <img src="https://img.koobai.com/koobai.webp" />
      </a>
    </div>
    <a href="https://github.com/koobai/blog" title="Github" target="_blank" data-umami-event="Github" className="githuab">
      <svg aria-hidden="true" viewBox="0 0 16 16" version="1.1" data-view-component="true">
        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
      </svg>
    </a>    
    <a href="https://space.bilibili.com/2084095738" target="_blank" title="当UP主的一天" data-umami-event="Bilibili">
      <svg width="20" height="20" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="zhuzhan-icon">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M3.73252 2.67094C3.33229 2.28484 3.33229 1.64373 3.73252 1.25764C4.11291 0.890684 4.71552 0.890684 5.09591 1.25764L7.21723 3.30403C7.27749 3.36218 7.32869 3.4261 7.37081 3.49407H10.5789C10.6211 3.4261 10.6723 3.36218 10.7325 3.30403L12.8538 1.25764C13.2342 0.890684 13.8368 0.890684 14.2172 1.25764C14.6175 1.64373 14.6175 2.28484 14.2172 2.67094L13.364 3.49407H14C16.2091 3.49407 18 5.28493 18 7.49407V12.9996C18 15.2087 16.2091 16.9996 14 16.9996H4C1.79086 16.9996 0 15.2087 0 12.9996V7.49406C0 5.28492 1.79086 3.49407 4 3.49407H4.58579L3.73252 2.67094ZM4 5.42343C2.89543 5.42343 2 6.31886 2 7.42343V13.0702C2 14.1748 2.89543 15.0702 4 15.0702H14C15.1046 15.0702 16 14.1748 16 13.0702V7.42343C16 6.31886 15.1046 5.42343 14 5.42343H4ZM5 9.31747C5 8.76519 5.44772 8.31747 6 8.31747C6.55228 8.31747 7 8.76519 7 9.31747V10.2115C7 10.7638 6.55228 11.2115 6 11.2115C5.44772 11.2115 5 10.7638 5 10.2115V9.31747ZM12 8.31747C11.4477 8.31747 11 8.76519 11 9.31747V10.2115C11 10.7638 11.4477 11.2115 12 11.2115C12.5523 11.2115 13 10.7638 13 10.2115V9.31747C13 8.76519 12.5523 8.31747 12 8.31747Z"></path>
      </svg>
    </a>
  </div>
</div>

      {/* <nav
        className="db flex justify-between w-100 ph5-l"
        style={{ marginTop: '3rem' }}
      >
        <div className="dib w-25 v-mid">
          <Link to={siteUrl} className="link dim">
            <picture>
              <img className="dib w3 h3 br-100" alt="logo" src={logo} />
            </picture>
          </Link>
        </div>
        <div className="dib w-75 v-mid tr">
          {navLinks.map((n, i) => (
            <a
              key={i}
              href={n.url}
              className="light-gray link dim f6 f5-l mr3 mr4-l"
            >
              {n.name}
            </a>
          ))}
        </div>
          </nav>*/}
    </>
  );
};

export default Header;
