package domain

// Role determines what a session may do. There are no accounts: a guest joins
// with the party code, the host joins with the host PIN.
type Role string

const (
	RoleGuest Role = "guest"
	RoleHost  Role = "host"
)

func (r Role) Valid() bool {
	return r == RoleGuest || r == RoleHost
}

// User is whoever is singing. Identity lasts one party and consists of a name
// and a colour for their avatar — nothing is stored about a person beyond what
// they typed on the join screen.
type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
	Role  Role   `json:"role"`
}
