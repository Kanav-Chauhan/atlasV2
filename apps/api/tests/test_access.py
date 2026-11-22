import pytest

from atlas_api.access import can_manage, can_read
from atlas_api.models import EVERYONE, Department, Document, Role, User


def user(role: Role, *depts: str, org_id: int = 1) -> User:
    return User(org_id=org_id, role=role, departments=[Department(name=d) for d in depts])


def doc(access: str, org_id: int = 1) -> Document:
    return Document(org_id=org_id, access=access)


@pytest.mark.parametrize(
    ("u", "access", "expected"),
    [
        (user(Role.admin), "Finance", True),
        (user(Role.admin), EVERYONE, True),
        (user(Role.manager, "HR"), "HR", True),
        (user(Role.manager, "HR"), "Finance", False),
        (user(Role.member, "Engineering"), "Engineering", True),
        (user(Role.member, "Engineering"), "Leadership", False),
        (user(Role.member, "Engineering"), EVERYONE, True),
        (user(Role.guest), EVERYONE, True),
        (user(Role.guest), "HR", False),
    ],
)
def test_can_read(u: User, access: str, expected: bool) -> None:
    assert can_read(u, doc(access)) is expected


@pytest.mark.parametrize("role", list(Role))
def test_other_org_never_readable(role: Role) -> None:
    u = user(role, "HR")
    assert not can_read(u, doc("HR", org_id=2))
    assert not can_read(u, doc(EVERYONE, org_id=2))


def test_can_manage() -> None:
    assert can_manage(user(Role.admin), "Finance")
    assert can_manage(user(Role.admin), EVERYONE)
    assert can_manage(user(Role.manager, "HR"), "HR")
    assert not can_manage(user(Role.manager, "HR"), "Finance")
    assert not can_manage(user(Role.manager, "HR"), EVERYONE)
    assert not can_manage(user(Role.member, "HR"), "HR")
    assert not can_manage(user(Role.guest), EVERYONE)
