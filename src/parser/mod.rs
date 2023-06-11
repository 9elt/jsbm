use pest::Parser;

#[derive(pest_derive::Parser)]
#[grammar = "parser/rules.pest"]
struct JsbmParser;

const TRIM: &[char] = &['{', '}', ' ', '\n', '\r'];

pub fn parse(file: &str) -> Result<Vec<Item>, ()> {
    let items = match JsbmParser::parse(Rule::Parse, file) {
        Ok(f) => match f.last() {
            Some(r) => r,
            _ => return Err(()),
        },
        _ => return Err(()),
    };

    let mut stack: Vec<Item> = vec![];

    for item in items.into_inner() {
        let rule = item.as_rule();

        if rule == Rule::Declaration {
            stack.push(Item::new(match item.into_inner().last() {
                Some(dec) => match dec.into_inner().find(|v| v.as_rule() == Rule::Value) {
                    Some(v) => v.as_str().trim_matches(TRIM),
                    _ => "",
                },
                _ => "",
            }))
        } else if rule == Rule::Content {
            let content = item.as_str().trim();

            if let Some(Item::Snippet(snippet)) = stack.last_mut() {
                snippet.code(content)
            } else {
                stack.push(Item::new_content(content));
            }
        }
    }

    Ok(stack)
}

#[derive(Debug)]
pub enum Item {
    Content(String),
    Snippet(Snippet),
}

impl Item {
    fn new(name: &str) -> Self {
        if name == "" {
            Self::Content("".to_string())
        } else {
            Self::Snippet(Snippet::new(name.to_string()))
        }
    }

    fn new_content(content: &str) -> Self {
        Self::Content(content.to_string())
    }
}

#[derive(Debug)]
pub struct Snippet {
    pub name: String,
    pub code: String,
}

impl Snippet {
    fn new(name: String) -> Self {
        Self {
            name,
            code: "".to_string(),
        }
    }

    fn code(&mut self, code: &str) {
        self.code = format!("{}{}", self.code, code)
    }
}
