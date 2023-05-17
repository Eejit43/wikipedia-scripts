/* global mw, OO, $ */

const redirectTemplates = {
    'R to acronym': ['Redirect to acronym'],
    'R from acronym': ['R acronym', 'Redirect from acronym', 'R acr', 'Redirect acr', 'Redirect acronym', 'R from ac', 'Redirect from ac', 'R from acr', 'Redirect from acr'],
    'R to initialism': ['R to initials', 'R to abbreviation', 'Redirect to initialism', 'Redirect to initials', 'Redirect to abbreviation', 'R to abbrev', 'Redirect to abbrev', 'R to abb', 'Redirect to abb', 'R to ab'],
    'R from initialism': ['R initialism', 'Rinit', 'Redirect from initialism', 'R in', 'Redirect in', 'R init', 'Redirect init', 'R from common initialism', 'Redirect from common initialism', 'R from common initials'],
    'R from numeronym': ['Redirect from numeronym', 'R numeronym'],
    'R from Bluebook abbreviation': ['R from Bluebook', 'R from bluebook'],
    'R from ISO 4 abbreviation': ['R from ISO4', 'R from ISO 4', 'Redirect from ISO 4 abbreviation', 'R iso4'],
    'R from MathSciNet abbreviation': ['R from MathSciNet'],
    'R from NLM abbreviation': ['R from NLM', 'R from MEDLINE abbreviation', 'R from MEDLINE'],
    'R from CamelCase': ['Redirect from CamelCase', 'R from camelcase', 'Rcc', 'R fCC', 'R from camel case', 'R from camelCase', 'R from StudlyCaps', 'R from studlycaps', 'R from studly caps', 'R from Studly Caps'],
    'R from other capitalisation': ['R for alternate capitalization', 'R for alternate capitalisation', 'R for alternative capitalization', 'R for alternative capitalisation', 'R from alternate capitalisation', 'R from alternative capitalisation', 'R from other capitalization', 'R from alternate capitalization', 'R from lowercase', 'R from alt cap'],
    'R from miscapitalisation': ['R from miscapitalization', 'R from incorrect capitalisation', 'R from incorrect capitalization', 'Redirect from miscapitalisation', 'Redirect from incorrect capitalization', 'Redirect from incorrect capitalisation', 'R miscap', 'R from overcapitalisation', 'R from over-capitalisation', 'R from over-capitalization'],
    'R from modification': ['R mod', 'R from alteration', 'R from rearrangement', 'Redirect to modification', 'R to modification', 'Redirect from modification', 'Redirect from rearrangement', 'R from word reorder', 'Redirect from word reorder', 'Redirect from other word order'],
    'R from plural': ['R from Plural', 'R to singular', 'Redirect to singular', 'Redirect from plural', 'R from pluralization', 'Redirect from pluralization', 'R from pluralisation', 'Redirect from pluralisation', 'R from plural form', 'Redirect from plural form'],
    'R to plural': ['R from singular', 'Redirect from singular', 'Redirect to plural', 'R to pluralization', 'Redirect to pluralization', 'R to pluralisation', 'Redirect to pluralisation', 'R in singular form', 'Redirect in singular form', 'R from singular form'],
    'R from adjective': ['Redirect from adjective', 'R from adjective phrase', 'Redirect from adjective phrase', 'R from adj', 'Redirect from adj', 'R adj', 'Redirect adj', 'R aj', 'Redirect aj', 'R from adjectival form'],
    'R from adverb': ['R adv', 'Redirect from adverb', 'R adverb', 'R from adverbial phrase'],
    'R from gerund': ['R ge', 'Redirect ge', 'Redirect from gerund'],
    'R from proper noun': ['Redirect from proper noun', 'R from proper name', 'Redirect from proper name', 'R from capitalised noun', 'Redirect from capitalised noun', 'R from capitalized noun', 'Redirect from capitalized noun', 'R from proper', 'Redirect from proper', 'R pn'],
    'R from alternative spelling': ['R from alt spelling', 'R from spelling', 'R from alternate spelling', 'R from another spelling', 'R from alternative spellings', 'R from other spelling', 'R from alternative punctuation', 'R spell', 'R from punctuation', 'R from different spelling'],
    'R from alternative transliteration': ['Redirect from alternative transliteration', 'R altrans', 'R from transliteration', 'R from alt transliteration', 'R from alternate transliteration', 'Redirect from transliteration', 'R from alternative romanisation', 'R from other transliteration', 'R from another transliteration', 'R from romanization'],
    'R from verb': ['Redirect from verb', 'R from verb phrase', 'Redirect from verb phrase', 'R from verb tense', 'Redirect from verb tense', 'R vb', 'Redirect vb', 'R verb', 'Redirect verb'],
    'R from American English': ['R to British', 'R from American', 'Redirect from American English', 'R from AE', 'R from American spelling', 'R from an Americanism', 'R from Americanism', 'R from AmEng'],
    'R from ASCII-only': ['Redirect from ASCII', 'R fa', 'R from ASCII', 'Redirect from ASCII-only', 'R from ASCII-only title', 'R from ascii', 'R from ASCII only'],
    'R from common noun': ['Redirect from noun', 'R from noun phrase', 'Redirect from noun phrase', 'R noun', 'Redirect noun', 'R from noun', 'Redirect from common noun'],
    'R from British English': ['R from UK spelling', 'R from British', 'R to American', 'Redirect from UK spelling', 'Redirect from British English', 'R from BE', 'R from British spelling', 'R from BrE', 'R from british'],
    'R to ASCII-only': ['R ta', 'R to ASCII', 'Redirect to ASCII-only'],
    'R from diacritic': ['R from name with diacritics', 'R from title with diacritics', 'R with diacritics', 'Redirect from title with diacritics', 'Redirect from diacritics', 'R dia', 'R from accent', 'R with accents', 'R from diacritics', 'Redirect from diacritic'],
    'R to diacritic': ['R to accents', 'Redirects from title without diacritics', 'RDiacr', 'R to unicode name', 'R to unicode', 'R to title with diacritics', 'R from name without diacritics', 'R from original name without diacritics', 'R without diacritics', 'R diacritics'],
    'R from alternative language': ['R from alternate language', 'R from another language', 'R from other language', 'R from language', 'R from Foreign name', 'R alter lang', 'R-alter-lang', 'Ralterlang', 'R from alt lang', 'R from foreign name'],
    'R from stylization': ['Redirect from stylization', 'R sty', 'Redirect sty', 'R stylized', 'Redirect stylized', 'R stylised', 'Redirect stylised', 'Redirect cs', 'R styled', 'R from stylisation'],
    'R to ligature': ['R from title without ligatures', 'R to ligatures', 'Redirect to ligature'],
    'R from ligature': ['R from title with ligatures', 'R from ligatures', 'Redirect from ligature'],
    'R from ambiguous sort name': ['R from sort name/ambiguous'],
    'R from misspelling': ['R from mispelling', 'R for misspelling', 'R from mispeling', 'R from typo', 'R from misspellings', 'R from incorrect spelling', 'R from misprint', 'R from misspeling', 'R from mispellings', 'R misspelling'],
    'R from antonym': ['R from opposite', 'R ant', 'Redirect from antonym', 'R antonym'],
    'R from colloquial name': ['R from slang', 'R from slang term', 'R from slang name', 'R slang', 'R from colloquial', 'R colloquial', 'Redirect from colloquial name'],
    'R from alternative name': ['R from alt name', 'R from alternative names', 'R from alternate names', 'R from alternate title', 'R from alternate name', 'R from other name', 'R from Alternative name', 'R from another name', 'R to alternative name', 'R to other name'],
    'R from incorrect name': ['R from incorrect title', 'Redirect from incorrect name', 'R from wrong name', 'Redirect from wrong name', 'R from improper name', 'Redirect from improper name', 'R from inappropriate name', 'Redirect from inappropriate name', 'Redirect from incorrect title', 'R from wrong title'],
    'R from former name': ['R from historic name', 'R from historical name', 'R from obsolete name', 'R from old name', 'R from previous name', 'R to current name', 'R old', 'Redirect from historic name', 'R former', 'R from original name'],
    'R from less specific name': ['R general', 'R from more general name', 'Redirect from more general name', 'Redirect from a more general name', 'Redirect from a less specific name', 'Redirect from less specific name', 'R less specific', 'R to less general name', 'R to more specific name', 'R from generic name'],
    'R from incomplete name': ['R from an incomplete name', 'R from incomplete title', 'R to complete name', 'Redirect to complete name', 'R to complete title', 'Redirect to complete title', 'Redirect from incomplete name', 'Redirect from incomplete title', 'R incomplete title', 'R from partial name'],
    'R from long name': ['R from full title', 'R full name', 'R from complete name', 'R to short name', 'R to short title', 'R from full name', 'R from longer', 'R long', 'R full', 'Redirect from full name'],
    'R from numerals': ['Redirect from numerals', 'R from numeral', 'Rfn', 'R from numbers'],
    'R from more specific name': ['R from specific name', 'R from more correct name', 'R from subtitle', 'R specific', 'R to less specific', 'R from more specific', 'Redirect to less specific', 'Redirect to more general', 'R to less specific name', 'R to more general name'],
    'R from non-neutral name': ['R from non-neutral', 'R nnn', 'R pejorative', 'R from ethnic slur', 'R to neutral name', 'R to neutral', 'R from pejorative', 'R from pejorative name', 'R from derogatory', 'R from derogatory name'],
    'R to numerals': ['Rtn', 'Redirect to numerals', 'R to numeral', 'Redirect to numeral', 'R to numbers'],
    'R to Roman numerals': [],
    'R from Roman numerals': ['Template', 'Redirect from Roman numerals', 'R from Roman Numerals', 'Rfrn', 'R from Roman numeral'],
    'R from portmanteau': ['Pariah24/Drafts/Template', 'R portmanteau', 'Redirect from portmanteau', 'R from blend'],
    'R from short name': ['R from shorter name', 'R short', 'R to full name', 'R to long name', 'R from shortening', 'R from contraction', 'R from shorter form of name', 'R from short title', 'R from abbreviated title', 'R from shortened name'],
    'R from sort name': ['R so', 'Redirect so', 'R sort', 'Redirect sort', 'R sorted', 'Redirect sorted', 'R sort name', 'Redirect sort name', 'R sorted name', 'Redirect sorted name'],
    'R from synonym': ['R synonym', 'R syn', 'Redirect from synonym', 'R to synonym'],
    'R from given name': ['R from forename', 'R from first name', 'R given name', 'Redirect from given name', 'R from mononym'],
    'R to joint biography': ['Redirect to joint biography', 'R jointbio', 'R to joint bio'],
    'R from married name': ['R mn', 'R to birth name', 'Redirect from married name', 'Redirect to married name'],
    'R from person': ['R from people', 'R from persons', 'Redirect from person', 'Redirect from people', 'R from founder', 'R from cofounder', 'R from executive', 'R from boardmember', 'R from co-founder', 'Rpers'],
    'R from surname': ['R surname', 'Redirect from surname', 'R from family name', 'Redirect from family name', 'R from last name', 'Redirect from last name', 'R sur'],
    'R to technical name': ['Redirect to technical name', 'R to technical title', 'Redirect to technical title', 'R to technical term', 'Redirect to technical term', 'Redirect to actual name', 'R to actual name', 'R to actual title', 'Redirect to actual title', 'Redirect to true name'],
    'R from pseudonym': ['R from stage name', 'Redirect from pseudonym', 'R from pen name', 'Redirect form pseudonym', 'Redirect from pen-name', 'Redirect from pen name', 'Redirect from stage name'],
    'R from scientific abbreviation': ['Rsa', 'R sa', 'Redirect from scientific abbreviation'],
    'R from Eastern name': [],
    'R from Java package name': ['R java', 'Redirect from Java package name'],
    'R from birth name': ['R from maiden name', 'R nee', 'R to married name', 'Redirect from birth name', 'Redirect from maiden name', 'Redirect from unmarried name', 'R ne', 'R deadname', 'R from deadname'],
    'R to monotypic taxon': ['R to mt', 'Redirect to monotypic taxon', 'R to monotypic'],
    'R from drug trade name': ['R to trade name', 'Redirect from trade name', 'R from trade name', 'R from trade'],
    'R from chemical formula': ['Rmf', 'Redirect from molecular formula', 'Redirect from formula', 'Redirect from chemical formula', 'R from empirical formula', 'Redirect from empirical formula', 'R mf', 'R from molecular formula'],
    'R from radio frequency': [],
    'R from court case': [],
    'R from filename': ['R from filename title', 'R filename', 'Redirect from filename', 'R from file name'],
    'R from personal name': ['Rpn', 'R p n', 'Redirect from personal name', 'R from legal name', 'R from personal', 'Rpersn'],
    'R from monotypic taxon': ['R from mt', 'Redirect from monotypic taxon', 'R from monotypic'],
    'R taxon with possibilities': ['R from taxon with possibilities', 'Redirect from taxon with possibilities', 'R from subtaxon', 'R from subspecies'],
    'R from name with title': ['R from honorific', 'R from honorific name', 'R from honorary', 'R from honorary title', 'R from honorific title', 'R from honorific style', 'R from honorary name', 'R with title', 'R from honorable title', 'Redirect from name with title'],
    'R from CAS Registry Number': ['R from CAS number', 'R from CAS Registry number', 'R from CAS Number', 'Redirect from CAS Registry Number'],
    'R from identifier': ['R from citation identifier'],
    'R from scientific name': ['Rsci', 'Redirect from scientific name', 'R from biological name', 'Redirect from biological name', 'R from scientific title', 'Redirect from scientific title', 'R from binomial name', 'Redirect from binomial name', 'R from species name', 'Redirect from species name'],
    'R from technical name': ['R from technical term', 'R from jargon', 'R from jargon name', 'Rftn', 'Redirect from technical name', 'R from technical', 'Redirect from technical', 'R from technical title', 'Redirect from technical title', 'Redirect from jargon name'],
    'R from gene symbol': ['R gene', 'Redirect from gene symbol', 'R gene symbol'],
    'R to scientific name': ['R from common name', 'Redirect to scientific name', 'R to biological name', 'Redirect to biological name', 'R to astronomical name', 'Redirect to astronomical name', 'R to scientific title', 'Redirect to scientific title', 'R from non-scientific name', 'Redirect from non-scientific name'],
    'R from name and country': ['Redirect from name and country', 'R nac', 'R from location and country', 'R from name, country'],
    'R from species to genus': [],
    'R from alternative scientific name': ['R from taxonomic synonym', 'Raltsci', 'R asn', 'Redirect asn', 'R to alternative scientific name', 'Redirect from biological synonym', 'R from another scientific name', 'Redirect from alternative scientific name', 'Redirect from taxonomic synonym', 'Redirect to alternative scientific name'],
    'R from more specific geographic name': ['R to Spanish municipality', 'R from specific geographic location', 'R from more specific place name', 'R from specific place name', 'R from specific geographic name', 'R from geo', 'Redirect from more specific geographic name', 'R from more specific geographic location'],
    'R from postal code': ['Redirect from postal code', 'R from postcode', 'Redirect from postcode'],
    'R to anchor': ['R to Anchor', 'R to anchors', 'R to embedded anchor', 'Rta', 'Redirect to anchor', 'R anchor', 'R to table row'],
    'R avoided double redirect': ['R adr', 'Radr', 'R double redirect avoided', 'Redirect avoided double redirect', 'Avoided double redirect', 'R from avoided double redirect', 'R avoid 2R', 'R avoid 2r', 'R avoiding double redirect', 'A2r'],
    'R from category navigation': ['Redirect from category navigation'],
    'R to list entry': ['R to list', 'R list', 'Redirect to list entry', 'Redirect to list', 'R to list item', 'R to a list entry', 'R from breed to list', 'R to glossary entry', 'R from list entry'],
    'R from file metadata link': ['R from exif', 'Redirect from EXIF', 'R from EXIF', 'R from Exif', 'R metadata', 'Redirect from EXIF file metadata link', 'Redirect from file metadata link', 'R from file metadata'],
    'R mentioned in hatnote': ['R hatnote', 'R mentioned in a hatnote', 'Redirect mentioned in hatnote', 'R from hatnote'],
    'R from shortcut': ['R tsh', 'R from template shortcut', 'R from Shortcut', 'R template short', 'R temp short', 'Redirect from shortcut', 'R from template shortcuts', 'Rsh', 'Redirect from template shortcut', 'R from short cut'],
    'R to section': ['R to subsection', 'R to Section', 'R from section', 'R section', 'R sect', 'Redirect to section', 'R sec', 'Redirect sec', 'R se', 'Redirect se'],
    'R to disambiguation page': ['R to disambiguation', 'R to disambig', 'R to dab', 'R from disambiguation', 'R from disambig', 'Redirect to disambiguation page', 'R disambig', 'R dab', 'R to dis', 'Redirect to dis'],
    'R from incomplete disambiguation': ['R from partial disambiguation', 'Redirect from incomplete disambiguation', 'R indab', 'R from missing disambiguation', 'Redirect from missing disambiguation', 'Redirect md', 'R from insufficient disambiguation', 'R from incomplete disambigaution', 'R partial dab', 'R from incomplete dab'],
    'R from incorrect disambiguation': ['R wrongdab', 'R id', 'Redirect id', 'R wd', 'Redirect wd', 'Redirect from incorrect disambiguation', 'R from incorrect disambig', 'R incorrect disambiguation'],
    'R from ambiguous term': ['R from ambiguous name', 'R from ambiguous', 'R from ambiguous word', 'R from ambiguous title', 'Redirect from ambiguous page', 'R from ambig', 'Redirect from ambig', 'R ambig', 'R from ambiguous page name', 'R from ambiguous page'],
    'R from move': ['R move', 'Redirect from move', 'R from page move', 'Redirect from page move', 'R pm', 'Redirect pm', 'Redirect move', 'R page move', 'Redirect page move', 'R from rename'],
    'R from merge': ['R from former child', 'R from merges', 'R to merge', 'R after merge', 'R from Merge', 'R FROM MERGE', 'R From Merge', 'Redirect from merge', 'R merge', 'R from merger'],
    'R from remote talk page': ['R from remote page', 'R from remote talk', 'R from remote talkpage', 'R to unified talk page', 'Redirect from remote talk page'],
    'R to main namespace': ['R to main', 'Redirect to main namespace', 'R to mainspace', 'Redirect to main', 'R to article namespace'],
    'R to template namespace': ['R to template', 'Redirect to template namespace', 'Redirect to template', 'R to templatespace', 'R to template space', 'R to template page'],
    'R with old history': ['R from old history', 'Redirect old', 'R foh', 'R woh', 'Redirect with old history', 'Rwoh'],
    'R from film': ['Redirect from film', 'R from a film', 'Redirect from a film', 'R from documentary', 'R from movie'],
    'R to help namespace': ['R help', 'R to help', 'Redirect to help namespace', 'R to helpspace', 'R to help page'],
    'R from other disambiguation': ['R from alternative disambiguation', 'R fod', 'R to other disambiguation', 'R to alternative disambiguation', 'R from alternate disambiguation', 'R to alternate disambiguation', 'R from other dab', 'R from alt disambig', 'R from different disambiguation', 'Redirect from other disambiguation'],
    'R to project namespace': ['R to wikipedia namespace', 'R to Project', 'R To Project', 'R to project', 'Redirect to project', 'R to Wikipedia namespace', 'Redirect to project namespace', 'R WP', 'Redirect WP', 'R to project space'],
    'R from unnecessary disambiguation': ['R undis', 'R from extra disambiguation', 'Redirect from unnecessary disambiguation', 'R from unnecessary disambig', 'Redirect from unnecessary disambig', 'R from unneeded disambiguation', 'Redirect from unneeded disambiguation', 'Redirect from extra disambiguation', 'R from added disambiguation', 'Redirect from added disambiguation'],
    'R from draft namespace': ['R from Draft', 'R from drafts', 'R from draftspace', 'R from draft', 'Redirect from draft namespace'],
    'R from meme': ['Redirect from meme', 'R from Internet meme', 'R meme'],
    'R with history': ['Rwh', 'R from history', 'Redirect with history', 'R history'],
    'R from upcoming film': ['R from future film', 'R from an upcoming film', 'R from upcoming films', 'R from upcoming television series', 'R from upcoming series', 'R from an upcoming series'],
    'R from lyric': ['R from hook line', 'R from lyrics', 'Redirect from lyric'],
    'R from predictable disambiguation': ['R predictable', 'R from predictable', 'R from predictable disambig', 'R predictable disambig', 'R predictable disambiguation', 'R predict', 'Redirect from predictable disambiguation'],
    'R to portal namespace': ['R to portal space', 'R from portal', 'R to portal', 'Redirect to portal namespace', 'Redirect to portal', 'R to portal page'],
    'R to user namespace': ['R to user', 'Redirect to user namespace', 'R to userspace', 'R from outside userspace'],
    'R to category namespace': ['R to category space', 'R to category', 'R to cat', 'Redirect to category namespace', 'R cat', 'R to category page', 'R to categoryspace'],
    'R from journal': ['R journal', 'Redirect from journal', 'R from journal to publisher'],
    'R from television program': ['R from television series', 'R from television show', 'Redirect from television program', 'R from web series', 'R from television programme'],
    'R to draft namespace': ['R to draftspace', 'R to draft', 'Redirect to draft namespace'],
    'R to talk page': ['Redirect to talk page', 'R to talk namespace', 'Redirect to talk namespace', 'R to talk', 'Redirect to talk', 'R talk p', 'R talk'],
    'R from album': ['R from EP', 'Redirect from album', 'R from an album', 'Redirect from EP', 'R to song', 'R from soundtrack'],
    'R from book': ['R from a book', 'From books', 'R book', 'Redirect from a book', 'Redirect from book', 'R to author', 'R from novel', 'R from book to author'],
    'R from television episode': ['R from episode', 'ER to list entry', 'Redirect to television episode list entry', 'Redirect to TV episode list entry', 'R to TV list entry', 'R to TV episode', 'R to TV episode list entry', 'R from TV episode', 'Redirect from television episode'],
    'R from work': ['R creative work', 'R work', 'R from creative work', 'R from poem', 'R poem', 'R from opera', 'R opera', 'R operetta', 'R from operetta', 'R from cartoon'],
    'R from duplicated article': ['R from duplicate', 'Redirect from duplicated article', 'R du', 'Redirect du', 'R duplicated', 'Redirect duplicated', 'R duplicated article', 'Redirect duplicated article', 'R double', 'Redirect double'],
    'R from song': ['R from songs', 'R from track', 'Redirect from song', 'Redirect from songs', 'Redirect from track', 'R from music video', 'Redirect from music video', 'R from a song', 'R to album', 'R from song name'],
    'R from cover song': ['Redirect from cover song', 'R from cover', 'R cover'],
    'R from band name': ['R band', 'R from group name', 'R to band leader', 'R to group leader', 'Redirect from band name', 'Redirect from group name', 'R from band'],
    'R from creator': [],
    'R from fictional character': ['R from character', 'Character redirect entry', 'Crl', 'CharR to list entry', 'R to character list entry', 'R fc', 'Redirect from fictional character', 'Redirect from character', 'Redirect to character list entry'],
    'R from fictional location': ['R fp', 'R from fictional place', 'R fl'],
    'R from fictional element': ['FictR to list entry', 'R fe', 'Redirect from fictional element'],
    'R comics with possibilities': ['Rcwp', 'R cwp', 'R comic', 'R from comic', 'R comics', 'Redirect comics with possibilities'],
    'R comics from alternative name': ['R from secret identity', 'R from alternative character', 'CR from alternative name', 'R from alternate character', 'Redirect from secret identity', 'R from alter ego', 'Redirect comics from alternative name'],
    'R comics from merge': ['R comics merge', 'R cmerge', 'Redirect comics from merge'],
    'R comics to list entry': ['R comics list', 'Redirect comics to list entry'],
    'R comics naming convention': ['R naming convention comics', 'R cnc', 'Redirect comics naming convention'],
    'R comics from related word': ['Rcrw', 'R crw', 'R comics from related words'],
    'R comics to section': ['R comsect', 'Redirect comics to section'],
    'R to article without mention': ['R without', 'R to an article without mention', 'R without mention', 'Not mentioned in target', 'Redirect to article without mention', 'R to page without mention', 'R not mentioned at target', 'R with no mention', 'R awm', 'R not mentioned'],
    'R from domain name': ['R from dotcom', 'Redirect from domain name', 'R dn', 'Redirect dn', 'R from url', 'R from website', 'R from URL', 'R from web address', 'R from domain', 'R domain name'],
    'R to century': ['Redirect to century'],
    'R from second-level domain': ['R sld', 'R secdomain', 'R 2ld', 'Redirect from second-level domain', 'R from SLD', 'R from 2LD', 'R from second level domain'],
    'R to decade': ['Redirect to decade', 'R decade'],
    'R from Unicode code': ['R from unicode code', 'Runico', 'Redirect from Unicode code', 'R from Unicode code point'],
    'R from ISO 639 code': ['R from ISO 639', 'RISO-639', 'Redirect from ISO 639 code'],
    'R from city and state': ['Redirect from city and state', 'R citystate'],
    'R category with possibilities': ['Rcrwp', 'R cat with possibilities'],
    'R from list topic': ['R list topic', 'R flt', 'Redirect from list topic'],
    'R from ISO 15924 code': ['R from ISO 15924', 'RISO-15924', 'R 15924', 'Redirect from ISO 15924 code'],
    'R from gender': ['R from sex', 'R from feminine', 'R from masculine', 'Redirect from gender', 'R to gender-neutral name', 'R to gender', 'R gender'],
    'R from member': ['R from player', 'R from teammate', 'R from band member', 'Redirect from member', 'R from cast member', 'R to parent'],
    'R unprintworthy': ['Unprintworthy', 'Unprintworthy redirects', 'Unprintworthy redirect', 'R non-printworthy', 'R nonprintworthy', 'R from incorrect URL encoding', 'R up', 'Redirect up', 'R uw', 'Redirect uw'],
    'R to related topic': ['R to event', 'R to related article', 'R from related topic', 'R from related article', 'R to related term', 'Rrt', 'Redirect to related topic', 'R to included topic', 'R to related', 'R to related subject'],
    'R from legislation': ['Redirect from legislation', 'R from enacted legislation', 'Redirect from enacted legislation'],
    'R with possibilities': ['R with possiblities', 'R with poss', 'R with potential', 'R with options', 'Rwp', 'R with possibilites', 'R with possibility', 'Redirect with possibilities', 'R with Possibilities', 'Redirects with possibilities'],
    'R from gap in series': ['Redirect from gap in series', 'R from gap', 'R gap in series'],
    'R from emoji': ['R emoji', 'Remoj', 'Redirect from emoji'],
    'R from ISO 4217 code': ['RISO-4217', 'R ISO 4217', 'R from ISO 4217', 'R ISO 4217 code', 'R 4217 code', 'R 4217', 'R 4217 currency code', 'R from 4217 code', 'R from 4217 standard', 'R from 4217 abbreviation'],
    'R from spouse': ['R xsp', 'Redirect xsp', 'R spouse', 'Redirect spouse', 'R wife', 'Redirect wife', 'R husband', 'Redirect husband', 'R xw', 'Redirect xw'],
    'R from related word': ['R from related', 'R from other tense', 'R from related words', 'R from related term', 'R to related word', 'R related', 'Redirect from related word', 'Redirect from related words', 'Redirect from related', 'Redirect to related word'],
    'R from school': ['Redirect from school', 'R school'],
    'R from top-level domain': ['R topdomain', 'R topdotcom', 'R from TLD', 'R from tld', 'Redirect from top-level domain'],
    'R printworthy': ['Printworthy', 'Printworthy redirect', 'Printworthy redirects', 'R pw', 'Redirect pw', 'R yes print', 'R p', 'R printable', 'R suitable for offline version', 'Redirect from printworthy title'],
    'R from phrase': ['Redirect from phrases', 'R from phrases', 'Redirect from phrase', 'R phrase'],
    'R from Unicode character': ['R from unicode', 'Redirect from Unicode', 'Redirect from Unicode character', 'Redirect from unicode', 'R from U character', 'Redirect from U character', 'R u', 'Redirect u', 'R U', 'Redirect U'],
    'R from ISO 3166 code': ['R from ISO 3166', 'R from geographic code', 'Redirect from geographic code', 'R from ISO geographic code', 'Redirect from ISO geographic code', 'Redirect from ISO 3166 code', 'RISO-3166'],
    'R from high-use template': ['Redirect from high-use template'],
    'R with Wikidata item': ['R wikidata', 'R with wikidata', 'R Wikidata', 'R with Wikidata', 'Redirect wikidata', 'Soft redirect with Wikidata item/hard', 'Rwikidata', 'Wikidata redirect/hard'],
    'R from subtopic': ['R subtopic', 'R from included topic', 'Redirect from included topic', 'Redirect from subtopic', 'R from smaller topic', 'Redirect from smaller topic', 'R from small topic', 'Redirect from small topic', 'R from event', 'Redirect from event'],
    'R from relative': ['Redirect from relative', 'R from relatives', 'Redirect from relatives', 'R from related person', 'Redirect from related person', 'R from family', 'Redirect from family', 'R from family member', 'Redirect from family member', 'R from rel'],
    'R from quotation': ['R from quote', 'R from idiom', 'R quote', 'Redirect from quotation'],
    'R from team': ['R from squad', 'R from club', 'Redirect from team'],
    'R from template-generated category': ['Redirect from template-generated category'],
    'R to subtopic': ['R to smaller topic', 'Redirect to smaller topic', 'Redirect to smaller subject', 'Redirect to subtopic', 'R to small topic', 'Redirect to small topic', 'R to small subject', 'Redirect to small subject', 'R tst', 'R from hypernym']
};

const contentText = document.getElementById('mw-content-text');

mw.loader.using(['oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui.styles.icons-content'], async () => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page
    if (mw.config.get('wgAction') !== 'view') return; // Don't run if not viewing page

    const pageTitle = mw.config.get('wgPageName');

    const pageInfo = await new mw.Api().get({ action: 'query', prop: 'info', formatversion: 2, titles: pageTitle });

    if (pageInfo.query.pages[0].missing) promptCreation();
    else if (pageInfo.query.pages[0].redirect) showRedirectInfo(true);

    /**
     * Prompts the creation of a redirect if a page doesn't exist
     */
    function promptCreation() {
        const button = new OO.ui.ButtonWidget({ label: 'Create redirect', icon: 'articleRedirect', flags: ['progressive'] });
        button.$element[0].style.marginBottom = '10px';
        button.on('click', () => {
            contentText.removeChild(button.$element[0]);
            showRedirectInfo(false);
        });

        contentText.prepend(button.$element[0]);
    }

    /**
     * Shows the redirect information box
     * @param {boolean} exists Whether or not the page exists
     */
    async function showRedirectInfo(exists) {
        const editorBox = new OO.ui.PanelLayout({ padded: true, expanded: false, framed: true });
        editorBox.$element[0].style.backgroundColor = '#95d4bc';
        editorBox.$element[0].style.width = '700px';
        editorBox.$element[0].style.maxWidth = 'calc(100% - 50px)';
        editorBox.$element[0].style.margin = '0 auto 20px';

        /* Redirect target input */
        const RedirectInputWidget = function RedirectInputWidget(config) {
            OO.ui.TextInputWidget.call(this, config);
            OO.ui.mixin.LookupElement.call(this, config);
        };
        OO.inheritClass(RedirectInputWidget, OO.ui.TextInputWidget);
        OO.mixinClass(RedirectInputWidget, OO.ui.mixin.LookupElement);

        RedirectInputWidget.prototype.getLookupRequest = function () {
            const value = this.getValue();
            const deferred = $.Deferred();

            if (!value) deferred.resolve([]);
            else if (value.includes('#')) {
                const title = value.split('#')[0];

                new mw.Api()
                    .get({ action: 'parse', page: title, prop: 'sections', redirects: '1' })
                    .catch(() => null)
                    .then((result) => {
                        if (!result) deferred.resolve([]);
                        else {
                            const matchedSections = result.parse.sections.filter((section) => section.line.toLowerCase().startsWith(value.split('#')[1].toLowerCase()));
                            deferred.resolve(matchedSections.map((section) => ({ data: `${result.parse.title}#${section.line}`, label: `${result.parse.title}#${section.line}` })));
                        }
                    });
            } else {
                new mw.Api()
                    .get({ action: 'query', generator: 'allpages', gapprefix: value, gaplimit: 20, prop: 'info|pageprops' })
                    .catch(() => null)
                    .then((result) => {
                        if (!result) deferred.resolve([]);
                        else {
                            deferred.resolve(result.query?.pages ? Object.values(result.query.pages).map((page) => ({ data: page.title, label: new OO.ui.HtmlSnippet(`${page.title}${page.pageprops && 'disambiguation' in page.pageprops ? ' <i>(disambiguation)</i>' : ''}${'redirect' in page ? ' <i>(redirect)</i>' : ''}`) })) : []);
                        }
                    });
            }

            return deferred.promise({ abort() {} }); // eslint-disable-line no-empty-function
        };
        RedirectInputWidget.prototype.getLookupCacheDataFromResponse = (response) => response || [];
        RedirectInputWidget.prototype.getLookupMenuOptionsFromData = (data) => data.map((item) => new OO.ui.MenuOptionWidget({ data: item.data, label: item.label }));

        const redirectInput = new RedirectInputWidget({ placeholder: 'Target page name', required: true });
        redirectInput.on('change', () => {
            let value = redirectInput.getValue();
            value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');

            if (value.length > 0) {
                redirectInput.setValue(value[0].toUpperCase() + value.slice(1).replace(/_/g, ' '));
                submitButton.setDisabled(false);
            } else submitButton.setDisabled(true);

            updateSummary();
            needsCheck = true;
        });

        const redirectInputLayout = new OO.ui.FieldLayout(redirectInput, { label: new OO.ui.HtmlSnippet('<b>Redirect target:</b>'), align: 'top' });

        /* Redirect categorization template selection */
        const tagSelect = new OO.ui.MenuTagMultiselectWidget({
            allowArbitrary: false,
            verticalPosition: 'below',
            allowReordering: false,
            options: Object.keys(redirectTemplates).map((tag) => ({ data: tag, label: tag }))
        });
        tagSelect.getMenu().filterMode = 'substring';
        tagSelect.on('change', () => {
            const sortedTags = tagSelect.getValue().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            if (tagSelect.getValue().join(';') !== sortedTags.join(';')) tagSelect.setValue(sortedTags);

            updateSummary();
            needsCheck = true;
        });

        const tagSelectLayout = new OO.ui.FieldLayout(tagSelect, { label: new OO.ui.HtmlSnippet('<b>Redirect categorization template(s):</b>'), align: 'top' });

        /* Summary input */
        const summaryInput = new OO.ui.ComboBoxInputWidget({
            options: [
                { data: 'Resolve double redirect' }, //
                { data: 'Resolve self redirect' },
                { data: 'Remove incorrect rcats' }
            ]
        });

        const summaryInputLayout = new OO.ui.FieldLayout(summaryInput, { label: new OO.ui.HtmlSnippet('<b>Summary:</b>'), align: 'top' });

        /* Submit button */
        const submitButton = new OO.ui.ButtonWidget({ label: 'Submit', disabled: true, flags: ['progressive'] });
        submitButton.$element[0].style.marginTop = '5px';

        let needsCheck = true;
        submitButton.on('click', async () => {
            [redirectInput, tagSelect, summaryInput, submitButton].forEach((element) => element.setDisabled(true));
            submitButton.setLabel('Checking target validity...');

            /* Title validation */
            if (needsCheck) {
                const destination = redirectInput.getValue();

                if (!/^\s*[^|{}[\]]+\s*$/.exec(destination)) return promptError(destination, 'is not a valid page title!');

                try {
                    new mw.Title(destination);
                } catch {
                    return promptError(destination, 'is not a valid page title!');
                }

                const destinationResult = await new mw.Api().get({ action: 'parse', page: destination, prop: 'sections', redirects: '1' }).catch((_, data) => {
                    if (data.error.code === 'missingtitle') promptError(destination, 'does not exist!');
                    return false;
                });

                if (!destinationResult) return;

                if (destinationResult.parse.redirects?.[0]) {
                    const destinationRedirect = destinationResult.parse.redirects[0].to + (destinationResult.parse.redirects[0].tofragment ? `#${destinationResult.parse.redirects[0].tofragment}` : '');
                    return promptError(destination, `is a redirect to <a href="${mw.util.getUrl(destinationRedirect)}" target="_blank">${destinationRedirect}</a>. Retarget to that page instead, as double redirects aren't allowed.`);
                }

                if (destination.split('#').length > 1) {
                    const validSection = destinationResult.parse.sections.find((section) => section.anchor === destination.split('#')[1]);
                    if (!validSection) return promptError(null, `is a redirect to <a href="${mw.util.getUrl(destination)}" target="_blank">${destination}</a>, but that section does not exist!`);
                }
            }

            /* Edit/create redirect */
            submitButton.setLabel(`${exists ? 'Editing' : 'Creating'} redirect...`);

            const output = [
                `#REDIRECT [[${redirectInput.getValue()}]]`, //
                tagSelect.getValue().length > 0
                    ? `{{Redirect category shell|\n${tagSelect
                        .getValue()
                        .map((tag) => `{{${tag}${oldRedirectTagData?.[tag] ? `|${oldRedirectTagData[tag]}` : ''}}}`)
                        .join('\n')}\n}}`
                    : null,
                oldStrayText
            ]
                .filter(Boolean)
                .join('\n\n');

            const summary = (summaryInput.getValue() || summaryInput.$tabIndexed[0].placeholder) + ' (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])';

            const result = await new mw.Api()
                .edit(pageTitle, () => ({ text: output, summary }))
                .catch((error, data) => {
                    if (error === 'nocreate-missing')
                        return new mw.Api().create(pageTitle, { summary }, output).catch((error, data) => {
                            console.error(error); // eslint-disable-line no-console
                            mw.notify(`Error creating ${pageTitle}: ${data.error.info} (${error})`, { type: 'error' });
                        });
                    else {
                        console.error(error); // eslint-disable-line no-console
                        mw.notify(`Error editing or creating ${pageTitle}: ${data.error.info} (${error})`, { type: 'error' });
                        return false;
                    }
                });

            if (!result) return;

            mw.notify(`Redirect ${exists ? 'edited' : 'created'} successfully!`, { type: 'success' });

            window.location.href = mw.util.getUrl(pageTitle, { redirect: 'no' });
        });

        let warningMessage;

        /**
         * Alerts a user of an issue with the destination title
         * @param {string} title The destination title
         * @param {string} message The error message
         */
        function promptError(title, message) {
            const label = new OO.ui.HtmlSnippet(`${title ? `<a href="${mw.util.getUrl(title)}" target="_blank">${title}</a>` : 'This page'} ${message} Click again without making changes to submit anyway.`);
            if (warningMessage) warningMessage.setLabel(label);
            else {
                warningMessage = new OO.ui.MessageWidget({ type: 'error', inline: true, label });
                warningMessage.$element[0].style.marginTop = '8px';

                editorBox.$element[0].append(warningMessage.$element[0]);
            }
            [redirectInput, tagSelect, summaryInput, submitButton].forEach((element) => element.setDisabled(false));

            needsCheck = false;
        }

        /* Add elements to screen */
        editorBox.$element[0].append(redirectInputLayout.$element[0], tagSelectLayout.$element[0], summaryInputLayout.$element[0], submitButton.$element[0]);

        contentText.prepend(editorBox.$element[0]);

        /**
         * Updates the summary input placeholder
         */
        function updateSummary() {
            if (!exists) {
                if (!redirectInput.getValue()) summaryInput.$tabIndexed[0].placeholder = '';
                else summaryInput.$tabIndexed[0].placeholder = `Creating redirect to [[${redirectInput.getValue()}]]`;
            } else {
                const targetChanged = redirectInput.getValue() !== oldRedirectTarget;
                const tagsChanged = tagSelect.getValue().join(';') !== oldRedirectTags.join(';');

                if (targetChanged && tagsChanged) summaryInput.$tabIndexed[0].placeholder = `Changing redirect to [[${redirectInput.getValue()}]] and changing categorization templates`;
                else if (targetChanged) summaryInput.$tabIndexed[0].placeholder = `Changing redirect to [[${redirectInput.getValue()}]]`;
                else if (tagsChanged) summaryInput.$tabIndexed[0].placeholder = 'Changing categorization templates';
                else summaryInput.$tabIndexed[0].placeholder = 'Redirect cleanup';
            }
        }

        /* Load current target and tags, if applicable */
        let oldRedirectTarget, oldRedirectTags, oldRedirectTagData, oldStrayText;
        if (exists) {
            const pageContent = (await new mw.Api().get({ action: 'query', format: 'json', prop: 'revisions', formatversion: 2, titles: pageTitle, rvprop: 'content', rvslots: '*' })).query.pages[0].revisions[0].slots.main.content.trim();

            oldRedirectTarget = /^#REDIRECT:?\s*\[\[\s*([^|{}[\]]+?)\s*]]\s*/i.exec(pageContent)?.[1];
            oldRedirectTags = Object.entries(redirectTemplates)
                .map(([tag, redirects]) => ([tag, ...redirects].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.substring(1)}\\s*(\\||}})`).test(pageContent)) ? tag : null))
                .filter(Boolean)
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            oldRedirectTagData = Object.fromEntries(
                oldRedirectTags
                    .map((tag) => {
                        const match = new RegExp(`{{\\s*(?:${[tag, ...redirectTemplates[tag]].map((tag) => `[${tag[0].toLowerCase()}${tag[0]}]${tag.substring(1)}`).join('|')})\\|?(.*?)\\s*}}`).exec(pageContent);
                        return match ? [tag, match[1]] : null;
                    })
                    .filter(Boolean)
            );
            oldStrayText = [pageContent.match(/{{Short description\|.*?}}/i)?.[0], pageContent.match(/{{DISPLAYTITLE:.*?}}/)?.[0], pageContent.match(/{{italic title\|?.*?}}/i)?.[0], pageContent.match(/{{DEFAULTSORT:.*?}}/)?.[0]].filter(Boolean).join('\n');

            redirectInput.setValue(oldRedirectTarget.replaceAll('_', ' '));
            tagSelect.setValue(oldRedirectTags);
        }
    }
});
