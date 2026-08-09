// Seed initial du contenu éditable (CGU, Confidentialité, FAQ, Contact) — reprend le contenu
// qui était codé en dur dans le frontend, pour que rien ne se perde au passage en admin.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CGU_SECTIONS = [
  { title: 'PRÉAMBULE', body: "Les présentes conditions générales d'utilisation (ci-après dénommées « CGU ») régissent l'accès et l'utilisation du site internet www.patrimoine-immobilier.dz (ci-après dénommé « le Site »), édité par la société Eurl DWELLING-STAY et OFFICE-SERVICES (ci-après dénommée « l'Éditeur »)." },
  { title: "ARTICLE 1 - CHAMP D'APPLICATION, ACCEPTATION ET MODIFICATION DES CGU", body: "L'accès et l'utilisation du Site impliquent l'acceptation sans réserve des présentes CGU par l'Utilisateur. L'Éditeur se réserve le droit de modifier unilatéralement et à tout moment le contenu des présentes CGU." },
  { title: 'ARTICLE 2 : MENTIONS LÉGALES', body: "Le site « patrimoine-immobilier.dz » est édité par la société EURL DWELLING-STAY et OFFICE-SERVICES, au capital de 100 000 DZD, immatriculée au Registre de Commerce sous le numéro : R.C 23 B 1282265-16/00, dont le siège social est situé à l'adresse suivante : 12 Route de Sidi Yahia, Lot 116 Bir Mourad Raïs.\n\nTéléphone : 0770.68.23.48\nEmail : contact@patrimoine-immobilier.dz\n\nLe Directeur de la publication est M. Abdelkader BOUCHEBABA.\n\nLe Site est hébergé par ICOSNET spa, El Qods Business Center, 6ème étage de la Tour Centrale, 16002 Chéraga, Alger. Tél : 0982400300 - Fax : 0982400301" },
  { title: 'ARTICLE 3 : ACCÈS ET DISPONIBILITÉ DES SERVICES', body: "Le Site est accessible gratuitement à tout Utilisateur disposant d'un accès à internet. Tous les coûts afférents à l'accès au service sont à la charge de l'Utilisateur. L'Éditeur s'efforce de permettre l'accès au Site 24 heures sur 24, 7 jours sur 7, sauf en cas de force majeure ou d'un événement hors du contrôle de l'Éditeur, et sous réserve des éventuelles pannes et interventions de maintenance nécessaires au bon fonctionnement du Site et des services." },
  { title: 'ARTICLE 4 : COLLECTE DE DONNÉES', body: "Le Site assure à l'Utilisateur une collecte et un traitement d'informations personnelles dans le respect de la vie privée conformément à la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel." },
  { title: 'ARTICLE 5 : PROPRIÉTÉ INTELLECTUELLE', body: "Les marques, logos, signes ainsi que tout le contenu du Site (textes, images, son...) font l'objet d'une protection par le Code de la propriété intellectuelle et plus particulièrement par le droit d'auteur. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du Site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable de l'Éditeur." },
  { title: 'ARTICLE 6 : RESPONSABILITÉ', body: "Les sources des informations diffusées sur le Site sont réputées fiables mais le site ne garantit pas qu'il soit exempt de défauts, d'erreurs ou d'omissions. Les informations communiquées sont présentées à titre indicatif et général sans valeur contractuelle. Malgré des mises à jour régulières, le Site ne peut être tenu responsable de la modification des dispositions administratives et juridiques survenant après la publication." },
  { title: 'ARTICLE 7 : LIENS HYPERTEXTES', body: "Des liens hypertextes peuvent être présents sur le Site. L'Utilisateur est informé qu'en cliquant sur ces liens, il sortira du Site. Ce dernier n'a pas de contrôle sur les pages web sur lesquelles aboutissent ces liens et ne saurait, en aucun cas, être responsable de leur contenu." },
  { title: 'ARTICLE 8 : COOKIES', body: "L'Utilisateur est informé que lors de ses visites sur le Site, un cookie peut s'installer automatiquement sur son logiciel de navigation. Les cookies sont de petits fichiers stockés temporairement sur le disque dur de l'ordinateur de l'Utilisateur par votre navigateur et qui sont nécessaires à l'utilisation du Site. Les cookies ne contiennent pas d'information personnelle et ne peuvent pas être utilisés pour identifier quelqu'un." },
  { title: 'ARTICLE 10 : DROIT APPLICABLE ET JURIDICTION COMPÉTENTE', body: "La législation algérienne s'applique au présent contrat. En cas d'absence de résolution amiable d'un litige né entre les parties, les tribunaux algériens seront seuls compétents pour en connaître. Pour toute question relative à l'application des présentes CGU, vous pouvez joindre l'éditeur aux coordonnées inscrites à l'ARTICLE 2." },
];

const CONFIDENTIALITE_SECTIONS = [
  { title: 'PRÉAMBULE', body: "La présente politique de confidentialité décrit la manière dont la société Eurl DWELLING-STAY et OFFICE-SERVICES, éditrice du site www.patrimoine-immobilier.dz (ci-après « le Site »), collecte, utilise et protège les données à caractère personnel des Utilisateurs, conformément à la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel." },
  { title: '1. DONNÉES COLLECTÉES', body: "Dans le cadre de la création d'un compte, du dépôt d'une annonce ou d'une demande de recherche confiée, le Site peut collecter : nom, prénom, adresse e-mail, numéro de téléphone, nom de société et toute information nécessaire à la mise en relation entre propriétaires, professionnels de l'immobilier et particuliers." },
  { title: '2. FINALITÉS DU TRAITEMENT', body: "Les données collectées sont utilisées pour permettre la publication et la gestion des annonces, la mise en relation avec les demandeurs, l'envoi de notifications relatives au compte de l'Utilisateur, et l'amélioration des services proposés par le Site." },
  { title: '3. PARTAGE DES DONNÉES', body: "Les données personnelles ne sont communiquées qu'aux parties nécessaires à la réalisation d'une mise en relation (par exemple, un professionnel souhaitant répondre à une demande de recherche confiée) et ne sont jamais cédées à des tiers à des fins commerciales sans le consentement de l'Utilisateur." },
  { title: '4. DURÉE DE CONSERVATION', body: "Les données sont conservées pendant toute la durée d'utilisation du Site par l'Utilisateur, puis archivées ou supprimées conformément aux obligations légales applicables." },
  { title: "5. DROITS DE L'UTILISATEUR", body: "Conformément à la réglementation en vigueur, l'Utilisateur dispose d'un droit d'accès, de rectification et de suppression de ses données personnelles. Il peut exercer ce droit en contactant l'Éditeur à l'adresse contact@patrimoine-immobilier.dz ou via la page Contact." },
  { title: '6. COOKIES', body: "Le Site utilise des cookies nécessaires à son bon fonctionnement. Ces cookies ne permettent pas d'identifier personnellement l'Utilisateur et peuvent être désactivés depuis les paramètres du navigateur." },
  { title: '7. CONTACT', body: "Pour toute question relative à la présente politique de confidentialité, l'Utilisateur peut joindre l'Éditeur au 0770.68.23.48 ou par e-mail à contact@patrimoine-immobilier.dz." },
];

const FAQ_ITEMS = [
  { question: 'Comment déposer une annonce ?', answer: 'Pour déposer une annonce, vous devez créer un compte (Particulier ou Professionnel). Une fois connecté, cliquez sur le bouton "Déposer une annonce" et suivez les étapes du formulaire.' },
  { question: 'Comment confier une recherche ?', answer: 'Vous pouvez utiliser notre formulaire "Confier une recherche" accessible depuis le menu principal. Vous pourrez y spécifier vos critères (type de bien, budget, localisation) et nous nous chargerons de trouver le bien idéal pour vous.' },
  { question: 'Est-ce gratuit ?', answer: "L'inscription et la consultation des annonces sont gratuites. Certaines options de mise en avant ou services spécifiques peuvent être payants." },
  { question: "Comment contacter l'administrateur ?", answer: 'Vous pouvez utiliser le formulaire de contact disponible sur la page "Contactez-nous" ou nous appeler directement aux numéros indiqués.' },
];

const SETTINGS = {
  CONTACT_PHONE: '+213 21 00 00 00',
  CONTACT_EMAIL: 'contact@patrimoine-immobilier.dz',
  CONTACT_ADDRESS: 'Alger, Algérie',
  SUPPORT_CONTENT: "Notre service support est disponible pour vous accompagner dans l'utilisation de la plateforme : questions sur votre compte, vos annonces, un problème technique ou une réclamation. Contactez-nous via le formulaire de contact ou par téléphone, nous répondons sous 48h ouvrées.",
};

async function main() {
  const existingCgu = await prisma.legalSection.count({ where: { page: 'CGU' } });
  if (existingCgu === 0) {
    for (let i = 0; i < CGU_SECTIONS.length; i++) {
      await prisma.legalSection.create({ data: { page: 'CGU', order: i, ...CGU_SECTIONS[i] } });
    }
    console.log(`Seeded ${CGU_SECTIONS.length} sections CGU`);
  }

  const existingConf = await prisma.legalSection.count({ where: { page: 'CONFIDENTIALITE' } });
  if (existingConf === 0) {
    for (let i = 0; i < CONFIDENTIALITE_SECTIONS.length; i++) {
      await prisma.legalSection.create({ data: { page: 'CONFIDENTIALITE', order: i, ...CONFIDENTIALITE_SECTIONS[i] } });
    }
    console.log(`Seeded ${CONFIDENTIALITE_SECTIONS.length} sections Confidentialité`);
  }

  const existingFaq = await prisma.faqItem.count();
  if (existingFaq === 0) {
    for (let i = 0; i < FAQ_ITEMS.length; i++) {
      await prisma.faqItem.create({ data: { order: i, ...FAQ_ITEMS[i] } });
    }
    console.log(`Seeded ${FAQ_ITEMS.length} FAQ items`);
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log(`Seeded ${Object.keys(SETTINGS).length} site settings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
