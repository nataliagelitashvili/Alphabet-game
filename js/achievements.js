/* Achievements & Cultural Discoveries */
LL.achievements = {
  catalog: [
    { id: 'first_steps', title: 'პირველი ნაბიჯები', desc: 'გადაარჩინე პირველი 3 ასო კახეთში (ა, ბ, გ)', check: s => s.levels_completed >= 1 },
    { id: 'ten_letters', title: 'ანბანის მცველი', desc: 'შეაგროვე 12 ქართული ასო', check: s => s.letters.length >= 12 },
    { id: 'half_georgia', title: 'საქართველოს მოგზაური', desc: 'გაიარე 6 კუთხე და შეაგროვე 18 ასო', check: s => s.levels_completed >= 6 },
    { id: 'star_scholar', title: 'ოქროს ვარსკვლავი', desc: 'მოიპოვე 3 ვარსკვლავი მინიმუმ 3 დონეზე', check: s => Object.values(s.level_stars || {}).filter(v => v >= 3).length >= 3 },
    { id: 'all_33', title: 'დედა ენის გმირი', desc: 'გადაარჩინე ქართული ანბანის ყველა 33 ასო!', check: s => s.letters.length >= 33 }
  ],

  discoveriesCatalog: [
    { id: 'disc_1', title: 'ალაზნის ველი და ვაზი', region: 'კახეთი', text: 'კახეთი ქართული მეღვინეობისა და უძველესი მწიგნობრობის კერაა.' },
    { id: 'disc_2', title: 'ძველი თბილისის აივნები', region: 'თბილისი', text: 'ნარიყალას ძირში მოჩუქურთმებული ხის აივნები ძველი თბილისის სავიზიტო ბარათია.' },
    { id: 'disc_3', title: 'ბორჯომის წიწვოვანი ტყე', region: 'ბორჯომი', text: 'ბორჯომის ხეობა განთქმულია უნიკალური ტყეებითა და მინერალური წყლებით.' },
    { id: 'disc_4', title: 'სვეტიცხოველი და ჯვარი', region: 'მცხეთა', text: 'საქართველოს ძველი დედაქალაქი, სადაც არაგვი და მტკვარი ერთმანეთს ერთვის.' },
    { id: 'disc_5', title: 'ვარძიის კლდეში ნაკვეთი ქალაქი', region: 'ვარძია', text: 'XII საუკუნის კლდეში ნაკვეთი სამონასტრო კომპლექსი მტკვრის ხეობაში.' },
    { id: 'disc_6', title: 'შაორის ტბა და რაჭის მთები', region: 'რაჭა', text: 'მაღალმთიანი რაჭა ცნობილია სუფთა მდინარეებითა და უძველესი ტაძრებით.' },
    { id: 'disc_7', title: 'თუშეთის ფიქლის კოშკები', region: 'თუშეთი', text: 'კავკასიონის მაღალ მთებში მშრალი წყობით ნაგები ციხე-სოფლები.' },
    { id: 'disc_8', title: 'სვანური კოშკები და უშგული', region: 'სვანეთი', text: 'ევროპის ერთ-ერთი უმაღლესი დასახლება უნიკალური თავდაცვითი კოშკებით.' },
    { id: 'disc_9', title: 'შავი ზღვის სანაპირო', region: 'აჭარა', text: 'ზღვისპირა ბათუმი, სუბტროპიკული ბაღები და უძველესი ციხესიმაგრეები.' },
    { id: 'disc_10', title: 'ფარავნის ტბა', region: 'ჯავახეთი', text: 'საქართველოს უდიდესი ტბა ვულკანურ ზეგანზე.' },
    { id: 'disc_11', title: 'დედა ენა — იაკობ გოგებაშვილი', region: 'ასოყლაპიას სასახლე', text: '„ცოდნა მაშინ არის ნამდვილი სიმდიდრე, როდესაც მას სხვებსაც ვუზიარებთ.“' }
  ],

  async evaluate(state) {
    const newlyUnlocked = [];
    for (const a of this.catalog) {
      if (!state.achievements.includes(a.id) && a.check(state)) {
        state.achievements.push(a.id);
        newlyUnlocked.push(a);
      }
    }
    if (newlyUnlocked.length) {
      LL.progress.setLocal(state);
      const u = await LL.auth.user();
      if (LL.sb && u) {
        await LL.sb.from('progress').update({ achievements: state.achievements }).eq('user_id', u.id);
      }
      newlyUnlocked.forEach(a => this.toast(`მიღწევა გაიხსნა: ${a.title}`));
    }
  },

  toast(text) {
    const el = document.createElement('div');
    el.className = 'll-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('on'), 20);
    setTimeout(() => {
      el.classList.remove('on');
      setTimeout(() => el.remove(), 350);
    }, 3400);
  }
};